# Pagamento parcial de parcela do crediário

**Triado em:** 01/09/2026
**Estado:** ready-for-agent

## Agent Brief

**Categoria:** enhancement

**Resumo:** Permitir abater um valor parcial de uma parcela do crediário, deixando o saldo restante pendente na mesma parcela.

## Comportamento atual

O pagamento de parcela é binário. `parcelas_venda` tem `pago boolean` e `data_pagamento date`; não existe registro de quanto foi pago. Marcar como paga quita a parcela inteira.

Quando o cliente paga só parte, hoje sobram duas saídas ruins:

1. Editar `valor_parcela` para o valor recebido e marcar como paga — o restante desaparece da dívida.
2. Renegociar a venda, que cancela **todas** as parcelas pendentes e recria o parcelamento inteiro, para tratar uma só.

Não existe função de adicionar parcela avulsa: os únicos `insert` em `parcelas_venda` são o da venda e o da renegociação.

Seis consumidores tratam `pago` como binário e somam `valor_parcela`:

- `Credit.tsx` — `totalPago` / `totalPendente` por venda
- `Dashboard.tsx` — "a receber" (`.eq('pago', false)`)
- `ExpirationDates.tsx` — total pago do mês e o botão "Marcar como Pago"
- `clientTier.ts` — `classifyClient`, que decide o tier do cliente
- `clientScore.ts` — score por histórico de vendas
- Edge Function `send-whatsapp-reminder` — lembrete das parcelas a vencer

## Comportamento desejado

A dona registra um abatimento de qualquer valor (inclusive quebrado, ex. R$ 45,68) numa parcela. A parcela passa a mostrar quanto já foi pago e quanto falta, e **continua pendente** até o saldo zerar. Ao zerar, ela é considerada paga como hoje.

Uma parcela parcialmente paga continua aparecendo em Vencimentos e no lembrete do WhatsApp, porque ainda há saldo devedor.

### Modelo de dados

A verdade passa a ser calculada pelo banco, para que nenhum consumidor consiga divergir em silêncio:

- `valor_pago numeric(10,2) NOT NULL DEFAULT 0`, com `CHECK (valor_pago >= 0 AND valor_pago <= valor_parcela)`
- `saldo_devedor numeric(10,2) GENERATED ALWAYS AS (valor_parcela - valor_pago) STORED`
- Um trigger mantém `pago` e `valor_pago` coerentes nos dois sentidos:
  - escreveu `pago = true` → `valor_pago` recebe `valor_parcela`
  - escreveu `pago = false` → `valor_pago` volta a `0`
  - `valor_pago` atingiu `valor_parcela` → `pago` vira `true`
  - `valor_pago` abaixo de `valor_parcela` → `pago` vira `false`
  - `valor_parcela` foi reduzido abaixo do `valor_pago` → aparar `valor_pago` para o novo total (senão o CHECK estoura; ver `handleSaveInstallment`, que permite editar o valor)

`numeric(10,2)` nas duas colunas: valores com centavos são exatos e as comparações não sofrem erro de ponto flutuante. No lado do app, usar `roundMoney` de [format.ts](src/lib/format.ts), como o resto do código já faz.

### Sequência obrigatória (expand–contract)

O schema é aplicado à mão no painel e o deploy dispara sozinho no push da `main` — os dois acontecem em momentos diferentes, então a mudança precisa funcionar antes e depois.

1. **Migration primeiro, sozinha.** Adiciona colunas, trigger e faz o backfill `valor_pago = CASE WHEN pago THEN valor_parcela ELSE 0 END`.
2. **Depois o código.**

Isso é o que impede o Dashboard de quebrar: depois do backfill, `saldo_devedor` de toda linha existente é exatamente o número que o código soma hoje (`valor_parcela` nas pendentes, que têm `valor_pago = 0`). **A migration sozinha é um no-op** — Dashboard, Vencimentos, tier e lembrete devolvem os mesmos valores de antes.

## Interfaces-chave

- **`parcelas_venda`**: ganha `valor_pago` e `saldo_devedor` (gerada). `pago` continua existindo e passa a ser mantida pelo trigger — nenhuma tela precisa parar de escrever nela.
- **Os seis consumidores acima**: onde somam `valor_parcela` de parcelas pendentes, passam a somar `saldo_devedor`. Onde apenas filtram por `pago`, **não mudam** — o filtro continua correto sozinho.
- **`ParcelaForTier`** (`clientTier.ts`): ganha os campos de valor necessários para a mudança de tier descrita abaixo.
- **Registro do abatimento** (`Credit.tsx`): a ação escreve `valor_pago` acumulado e acrescenta uma linha em `observacoes` com data e valor do abatimento.

## Premissa registrada — limite do "sem histórico"

Foi decidido guardar **apenas o acumulado** (`valor_pago`), sem tabela de histórico de pagamentos. Com um único campo `data_pagamento`, é impossível representar literalmente "metade em dia e metade em atraso". A regra escolhida:

- **`data_pagamento` = data do último pagamento** (quando a parcela foi quitada). Preserva exatamente o significado atual no caso comum, e mantém `wasLate` querendo dizer "quitou depois do vencimento".
- O crédito por ter pago parte no prazo aparece na **severidade ponderada por valor**, abaixo — não na data.

Se depois for preciso julgar pontualidade pagamento a pagamento, isso exige a tabela `pagamentos_parcela` e é **outro item**.

## Mudança no tier (`classifyClient`)

`classifyClient` é categórica, não uma soma ponderada: hoje pergunta "existe parcela vencida em aberto?" e "há quantos dias?". Uma parcela de R$ 20 e uma de R$ 900 pesam igual.

A mudança pedida é dar peso ao **saldo devedor**, não à contagem:

- Uma parcela vencida com saldo continua contando como vencida (há dinheiro em atraso — isso é correto e conservador).
- A severidade passa a considerar o **saldo em atraso**, não só o número de parcelas vencidas. Quem pagou R$ 50 de R$ 100 no vencimento tem metade da exposição de quem não pagou nada, e o tier deve refletir isso.
- O limiar de `CRITICO` (hoje 30 dias de atraso) continua valendo; o que muda é o valor considerado.

O agente que implementar deve propor o critério numérico concreto e confirmá-lo antes de aplicar — este brief fixa a direção, não a fórmula.

## Critérios de aceite

Não há test runner neste projeto; os critérios abaixo usam as costuras que existem.

- [ ] `npm run build` e `npm run lint` passam.
- [ ] **Antes de qualquer mudança de código**, com a migration já aplicada: os totais de "a receber" no Dashboard, o total pago do mês em Vencimentos e os `totalPago`/`totalPendente` do Crediário são idênticos aos de antes da migration.
- [ ] Consulta ao banco pelo MCP: `select count(*) from parcelas_venda where valor_pago > valor_parcela` retorna `0`.
- [ ] Consulta ao banco: nenhuma linha com `pago = true and saldo_devedor > 0`, nem `pago = false and saldo_devedor = 0`.
- [ ] Em `/crediario`, abater R$ 45,68 de uma parcela de R$ 100,00 deixa a parcela pendente exibindo pago R$ 45,68 e saldo R$ 54,32.
- [ ] Essa parcela continua listada em `/vencimentos` como pendente, com o **saldo** (R$ 54,32), não com o valor cheio.
- [ ] Abater o saldo restante marca a parcela como paga, e ela sai das listagens de pendente.
- [ ] Desmarcar uma parcela paga zera o `valor_pago` (verificável pelo MCP).
- [ ] Reduzir o `valor_parcela` de uma parcela abaixo do já pago não gera erro: o `valor_pago` é aparado para o novo total.
- [ ] O somatório de "a receber" do Dashboard usa `saldo_devedor` — uma parcela parcialmente paga entra pelo que falta, não pelo valor cheio.

## Se der errado em produção

`main` faz deploy automático num app que a dona da loja usa para trabalhar todo dia.

- A migration é reversível: `saldo_devedor` e `valor_pago` podem ser removidos e o trigger dropado, voltando ao estado binário — nenhum dado de parcela é destruído, já que `valor_parcela` e `pago` continuam intactos.
- O modo de falha do lado do código, caso um consumidor seja esquecido, é **superestimar o a receber** (soma o valor cheio em vez do saldo). É conservador: nunca dá como paga uma parcela que não foi.
- O risco real a vigiar é o trigger deixar `pago` e `valor_pago` incoerentes. As duas consultas de aceite acima detectam isso e devem ser rodadas depois do deploy.

## Fora de escopo

- Tabela `pagamentos_parcela` com histórico pagamento a pagamento (ver premissa acima).
- Pagamento parcial em `parcelas_pagar` (contas a pagar de fornecedor) — este item é só crediário.
- Mudar o fluxo de renegociação.
- Mudar o `clientScore.ts` (score por histórico de vendas); aqui só o tier.
- Recibo/comprovante do abatimento parcial.
