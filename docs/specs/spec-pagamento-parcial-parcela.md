# Spec — Pagamento parcial de parcela do crediário

**Origem:** [docs/briefs/pagamento-parcial-parcela.md](../briefs/pagamento-parcial-parcela.md)
**Data:** 01/09/2026

## Problem Statement

A dona vende no crediário e recebe em dinheiro, no balcão. É comum o cliente aparecer no dia do vencimento e pagar **parte** da parcela — R$ 50,00 de uma de R$ 100,00, ou um valor quebrado qualquer, R$ 45,68.

O sistema não sabe representar isso. A parcela é paga ou não é. Hoje ela tem duas saídas, e as duas são ruins:

- Editar o valor da parcela para o que recebeu e marcar como paga — o restante some da dívida, e o cliente deixa de dever o que ainda deve.
- Renegociar a venda inteira, o que cancela **todas** as parcelas pendentes e recria o parcelamento, só para tratar uma.

Na prática ela acaba anotando por fora, e o Crediário deixa de refletir a realidade — que é justamente o que ele existe para fazer.

## Solution

A dona abre a parcela no Crediário e registra um **abatimento** de qualquer valor. A parcela passa a mostrar quanto já foi pago e quanto falta, e **continua pendente** até o saldo zerar. Quando zera, vira paga como sempre foi.

A parcela parcialmente paga continua aparecendo em Vencimentos e no lembrete do WhatsApp, porque ainda há saldo devedor — só que pelo **saldo**, não pelo valor cheio.

## User Stories

1. Como dona da loja, quero registrar que a cliente pagou R$ 50,00 de uma parcela de R$ 100,00, para o sistema refletir o que realmente recebi.
2. Como dona da loja, quero registrar valores quebrados como R$ 45,68, para não ter que arredondar o que a cliente me deu.
3. Como dona da loja, quero ver na parcela quanto já foi pago e quanto falta, para saber o que cobrar sem fazer conta de cabeça.
4. Como dona da loja, quero que a parcela parcialmente paga continue pendente, para não esquecer de cobrar o restante.
5. Como dona da loja, quero abater o restante depois e ver a parcela virar paga sozinha, para não precisar marcar nada à mão.
6. Como dona da loja, quero que a parcela parcialmente paga continue aparecendo em Vencimentos, para ela não sumir da minha lista de cobrança.
7. Como dona da loja, quero que Vencimentos mostre o **saldo** da parcela, não o valor cheio, para saber quanto ainda tenho a receber naquele mês.
8. Como dona da loja, quero que o total recebido do mês em Vencimentos inclua os abatimentos parciais, para o número bater com o que entrou no caixa.
9. Como dona da loja, quero que o "a receber" do Dashboard conte só o que falta, para o meu fluxo de caixa não ficar inflado por dinheiro que já recebi.
10. Como dona da loja, quero que o lembrete do WhatsApp cobre o saldo, não o valor cheio, para não constranger a cliente pedindo o que ela já pagou.
11. Como dona da loja, quero registrar vários abatimentos na mesma parcela até quitar, para acompanhar quem paga aos poucos.
12. Como dona da loja, quero que o sistema me impeça de abater mais do que o saldo, para não criar dívida negativa por engano.
13. Como dona da loja, quero desmarcar uma parcela que marquei paga por engano, e que ela volte a dever o valor inteiro, para corrigir o erro sem sequela.
14. Como dona da loja, quero corrigir o valor de uma parcela mesmo depois de já ter recebido parte dela, para consertar um cadastro errado.
15. Como dona da loja, quero que uma cliente que pagou parte no prazo seja tratada melhor no score do que uma que não pagou nada, para minhas decisões de fiado serem justas.
16. Como dona da loja, quero ver no histórico da parcela que houve um abatimento e de quanto, para lembrar do combinado quando a cliente voltar.

## Implementation Decisions

### Modelo de dados

A verdade passa a ser **calculada pelo banco**, para que nenhuma tela consiga divergir em silêncio.

```sql
valor_pago     numeric(10,2) NOT NULL DEFAULT 0
               CHECK (valor_pago >= 0 AND valor_pago <= valor_parcela)

saldo_devedor  numeric(10,2) GENERATED ALWAYS AS (valor_parcela - valor_pago) STORED
```

`valor_parcela` já é `numeric(10,2)` (verificado no banco), então centavos são exatos e as comparações não sofrem erro de ponto flutuante.

Um **trigger** mantém `pago` e `valor_pago` coerentes nos dois sentidos, para que as telas que hoje escrevem `pago` continuem funcionando sem alteração:

- escreveu `pago = true` → `valor_pago` recebe `valor_parcela`
- escreveu `pago = false` → `valor_pago` volta a `0`
- `valor_pago` atingiu `valor_parcela` → `pago` vira `true`
- `valor_pago` ficou abaixo → `pago` vira `false`
- `valor_parcela` foi reduzido abaixo do `valor_pago` → aparar `valor_pago` para o novo total, senão o CHECK estoura

Esse último caso não é hipotético: a edição de parcela no Crediário permite alterar o valor de uma parcela que já recebeu abatimento.

### Sequenciamento — a migration entra sozinha e primeiro

O schema é aplicado à mão no painel do Supabase e o deploy dispara sozinho no push da `main`. Os dois acontecem em momentos diferentes, então a mudança precisa funcionar antes e depois.

1. **Migration sozinha**: colunas, trigger e backfill `valor_pago = CASE WHEN pago THEN valor_parcela ELSE 0 END`.
2. **Só depois, o código.**

É isso que impede o Dashboard de quebrar. Depois do backfill, o `saldo_devedor` de toda linha existente é exatamente o número que o código soma hoje — `valor_parcela` nas pendentes, que ficam com `valor_pago = 0`. **A migration sozinha é um no-op observável**: Dashboard, Vencimentos, Crediário e lembrete devolvem os mesmos valores de antes.

Segue a convenção do projeto: um `migration_*.sql` na raiz **e** a atualização do `schema.sql`, que é o canônico. A aplicação é manual no painel — o MCP é read-only.

### Consumidores

Seis lugares tratam `pago` como binário e somam `valor_parcela`. A regra é simples: **onde apenas filtram por `pago`, não mudam** — o filtro continua correto sozinho, porque uma parcela parcial permanece `pago = false`. Onde **somam**, passam a somar `saldo_devedor`.

- **Crediário** ([Credit.tsx](../../src/pages/Credit.tsx)) — `totalPago` e `totalPendente` por venda; é também onde entra a ação de abater.
- **Dashboard** ([Dashboard.tsx](../../src/pages/Dashboard.tsx)) — o "a receber" distribui parcelas em atrasadas / 7 dias / 30 dias. Além de trocar a soma, o `select` precisa passar a trazer `saldo_devedor`; hoje ele busca apenas `valor_parcela, data_vencimento, pago`.
- **Vencimentos** ([ExpirationDates.tsx](../../src/pages/ExpirationDates.tsx)) — caso especial. Ele busca **todas** as parcelas (não filtra por `pago`) e deriva `totalPaid` somando `valor_parcela` das pagas, com `totalPending = totalDue - totalPaid`. Isso passa a **subestimar o recebido**: os R$ 45,68 de uma parcela ainda pendente não entram em lugar nenhum. A correção é somar `valor_pago` de todas as parcelas e `saldo_devedor` para o pendente — o que sai mais direto que a derivação atual. A listagem também deve exibir o saldo, não o valor cheio.
- **Tier do cliente** ([clientTier.ts](../../src/lib/clientTier.ts)) — ver seção própria abaixo.
- **Edge Function `send-whatsapp-reminder`** — cobra pelo saldo, não pelo valor cheio.
- **`clientScore.ts`** — fora de escopo; ele lê `vendas`, não parcelas.

No lado do app, todo cálculo monetário usa `roundMoney` de [format.ts](../../src/lib/format.ts), como o resto do código já faz.

### Registro do abatimento

A ação escreve o `valor_pago` acumulado e acrescenta uma linha em `observacoes` com data e valor do abatimento — o mesmo padrão que a renegociação já usa para deixar rastro.

Foi decidido guardar **apenas o acumulado**, sem tabela de histórico pagamento a pagamento.

### Tier do cliente e o limite do "sem histórico"

`classifyClient` é **categórica**, não uma soma ponderada: pergunta "existe parcela vencida em aberto?" e "há quantos dias de atraso?". Hoje uma parcela de R$ 20,00 e uma de R$ 900,00 pesam igual.

Com um único campo `data_pagamento`, é **impossível** representar literalmente "metade em dia e metade em atraso". A regra escolhida:

- `data_pagamento` = data do **último** pagamento, isto é, quando a parcela foi quitada. Preserva exatamente o significado atual no caso comum e mantém a checagem de atraso querendo dizer "quitou depois do vencimento".
- O crédito por ter pago parte no prazo aparece na **severidade ponderada pelo saldo em atraso**, não na data: uma parcela vencida com saldo continua contando como vencida, mas quem pagou R$ 50,00 de R$ 100,00 tem metade da exposição de quem não pagou nada.
- O limiar de `CRITICO` (30 dias) continua valendo; o que muda é o valor considerado.

Esta spec fixa a direção, **não a fórmula numérica**. Quem implementar deve propor o critério concreto e confirmá-lo antes de aplicar.

## Verification Decisions

Não há test runner neste projeto. Uma boa verificação aqui checa **comportamento externo** — o número que aparece na tela, a linha que existe no banco — nunca detalhe de implementação. Quatro costuras, confirmadas com o usuário:

**1. Invariantes no banco, via MCP.** Uma costura cobre todo o comportamento do trigger e do CHECK. Nenhuma linha pode existir com:
- `valor_pago > valor_parcela`
- `pago = true and saldo_devedor > 0`
- `pago = false and saldo_devedor = 0`

**2. Neutralidade da migration.** Aplicar a migration **sozinha**, sem tocar em código, e conferir que Dashboard ("a receber"), Vencimentos (totais do mês) e Crediário (`totalPago`/`totalPendente`) mostram números idênticos aos de antes. É a costura que protege a produção, e a única que precisa ser rodada em dois momentos.

**3. `npm run build` e `npm run lint`.** `tsc -b` pega os erros de tipo — em especial nas interfaces que ganham campos (`ParcelaForTier` e os tipos locais de cada página) e nos `select` que precisam passar a trazer `saldo_devedor`.

**4. Roteiro manual no navegador.** O fluxo completo, com o valor quebrado:
   1. Em `/crediario`, numa parcela de R$ 100,00, abater R$ 45,68.
   2. A parcela continua pendente, exibindo pago R$ 45,68 e saldo R$ 54,32.
   3. Em `/vencimentos`, ela aparece como pendente, pelo saldo R$ 54,32, e o total recebido do mês inclui os R$ 45,68.
   4. No Dashboard, o "a receber" conta R$ 54,32 para essa parcela, não R$ 100,00.
   5. Abater os R$ 54,32 restantes: a parcela vira paga e sai das listagens de pendente.
   6. Desmarcar a parcela: ela volta a dever R$ 100,00 integralmente.

**Prior art.** A verificação por consulta ao MCP já foi usada neste projeto na migração de RLS e na limpeza de storage — inclusive para provar comportamento *de fora*, com a chave publishable. Os scripts em `scripts/` são o precedente de dry-run antes de qualquer escrita.

## Out of Scope

- Tabela `pagamentos_parcela` com histórico pagamento a pagamento. Se um dia for preciso julgar pontualidade por pagamento, é outro item — e só ele destrava essa precisão.
- Pagamento parcial em `parcelas_pagar` (contas a pagar de fornecedor). Esta spec é só crediário.
- Mudanças no fluxo de renegociação.
- `clientScore.ts` — o score por histórico de vendas fica como está.
- Recibo ou comprovante do abatimento parcial.
- A fórmula numérica exata da ponderação do tier: a direção está fixada aqui, o critério é proposto na implementação.

## Further Notes

`main` faz deploy automático num app que a dona da loja usa para trabalhar todo dia. O que acontece se der errado:

- **A migration é reversível.** `valor_pago` e `saldo_devedor` podem ser removidos e o trigger dropado, voltando ao estado binário. Nenhum dado é destruído: `valor_parcela` e `pago` permanecem intactos o tempo todo.
- **O modo de falha do código é conservador.** Se um consumidor for esquecido, ele soma o valor cheio em vez do saldo — **superestima o a receber**. Nunca dá como paga uma parcela que não foi, e nunca some dívida.
- **O risco real a vigiar é o trigger deixar `pago` e `valor_pago` incoerentes.** As três consultas da costura 1 detectam isso e devem ser rodadas logo depois do deploy, não só antes.
- A ordem importa: migration primeiro, conferir a neutralidade, só então o código. Inverter isso é o único jeito de essa mudança derrubar algo.
