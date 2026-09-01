# 06: Tier do cliente ponderado pelo saldo em atraso

**O que construir:** quem pagou parte no prazo deixa de ser classificado igual a quem não pagou nada.

Hoje `classifyClient` em [clientTier.ts](../../../src/lib/clientTier.ts) é **categórica**, não ponderada: pergunta "existe parcela vencida em aberto?" e "há quantos dias?". Isso tem duas consequências. A primeira é a que motiva este ticket: uma parcela de R$ 100,00 com R$ 95,00 já pagos vencida ontem joga a cliente para `ATENCAO` do mesmo jeito que uma intocada. A segunda já existia antes da feature: uma parcela de R$ 20,00 e uma de R$ 900,00 pesam igual.

A direção é dar peso ao **saldo devedor em atraso**, não à contagem de parcelas:

- Parcela vencida com saldo continua contando como vencida — há dinheiro em atraso, e ignorar isso seria errado.
- A **severidade** passa a considerar o valor em aberto, não só quantas parcelas venceram.
- O limiar de `CRITICO` por dias de atraso (hoje 30) continua valendo; o que muda é o valor considerado.

`ParcelaForTier` precisa ganhar os campos de valor, e a consulta em `fetchClientTierMap` precisa trazê-los.

## Este ticket tem uma decisão dentro

A spec fixou a **direção**, não a fórmula — de propósito. O critério numérico decide se uma cliente real da loja aparece como `EXCELENTE`, `ATENCAO` ou `CRITICO`, e com isso se ela leva mercadoria fiado no próximo atendimento.

**Proponha o critério concreto e confirme com a dona antes de aplicar.** Leve números do banco real para a conversa: quantas clientes mudam de tier com o critério proposto, e quais. Uma mudança que reclassifica metade da carteira não é um refinamento, é outra política — e a decisão é dela.

## Limite conhecido

Foi decidido guardar apenas o acumulado em `valor_pago`, sem histórico pagamento a pagamento. Com um único `data_pagamento` (que passa a significar "quando quitou"), **não dá** para julgar pontualidade pedaço por pedaço. O crédito por ter pago parte no prazo aparece só na ponderação por saldo. Se isso não bastar, o caminho é a tabela `pagamentos_parcela` — item separado, fora desta feature.

**Bloqueado por:** 02 — Abater um valor de uma parcela no Crediário

**Status:** ready-for-agent

**Como verificar:**

- [ ] O critério numérico foi proposto **com números do banco real** (quantas e quais clientes mudam de tier) e aprovado pela dona antes de aplicar
- [ ] Uma cliente com parcela vencida e quase toda paga é classificada melhor que uma com a mesma parcela intocada
- [ ] Uma cliente com parcela vencida de valor alto e nada pago continua em `ATENCAO`, e passa a `CRITICO` depois de 30 dias
- [ ] Cliente sem nenhuma parcela vencida e sem histórico de atraso continua `EXCELENTE`
- [ ] Cliente sem nenhuma parcela continua `NOVO`
- [ ] A janela de reabilitação (as 3 últimas parcelas quitadas em dia promovem de volta a `EXCELENTE`) continua funcionando
- [ ] Com o banco atual, **antes** de existir qualquer parcela parcial, a distribuição de tiers é comparada com a de antes da mudança e as diferenças são explicáveis pelo novo peso por valor — nenhuma inexplicada
- [ ] `npm run build` e `npm run lint` passam
