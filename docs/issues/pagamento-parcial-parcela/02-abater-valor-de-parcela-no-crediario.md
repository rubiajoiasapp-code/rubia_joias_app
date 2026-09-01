# 02: Abater um valor de uma parcela no Crediário

**O que construir:** a bala traçante da feature. A cliente chega no balcão e paga parte da parcela; a dona registra o valor e vê, na mesma tela, quanto entrou e quanto falta.

Em `/crediario`, numa parcela de R$ 100,00, a dona abate R$ 45,68. A parcela **continua pendente**, agora exibindo pago R$ 45,68 e saldo R$ 54,32. Abatendo o restante, a parcela vira paga sozinha — sem ela precisar marcar nada à mão.

O abatimento acumula em `valor_pago` e acrescenta uma linha em `observacoes` com data e valor, seguindo o rastro que a renegociação já deixa. O `totalPendente` e o `totalPago` da venda passam a usar `saldo_devedor` e `valor_pago`.

Hoje isso vive em [Credit.tsx](../../../src/pages/Credit.tsx), que já tem dois modais como prior art de interação: a edição de parcela e a renegociação.

**Este ticket é o que torna a feature demonstrável.** Os demais ajustam telas que passam a mostrar o saldo — e nenhum deles pode ser conferido de verdade antes deste existir, porque não há como criar uma parcela parcialmente paga sem ele.

**Bloqueado por:** 01 — Migration `valor_pago`, `saldo_devedor` e trigger

**Status:** ready-for-agent

**Como verificar:**

Roteiro manual no navegador, com valor quebrado de propósito, mais duas consultas ao banco pelo MCP.

- [ ] Em `/crediario`, abater R$ 45,68 de uma parcela de R$ 100,00 deixa a parcela **pendente**, exibindo pago R$ 45,68 e saldo R$ 54,32
- [ ] A `observacoes` da parcela ganhou uma linha com a data e o valor do abatimento
- [ ] O `totalPendente` da venda caiu exatamente R$ 45,68; o `totalPago` subiu o mesmo tanto
- [ ] Abater os R$ 54,32 restantes marca a parcela como paga e ela sai da listagem de pendentes
- [ ] Tentar abater mais que o saldo é recusado com aviso — e nenhuma linha fica com `valor_pago > valor_parcela` (confirmar pelo MCP)
- [ ] Abater R$ 0,00 ou valor negativo é recusado
- [ ] Desmarcar uma parcela paga faz ela voltar a dever o valor **inteiro**, com `valor_pago` zerado (confirmar pelo MCP)
- [ ] Editar o `valor_parcela` de uma parcela que já recebeu abatimento, colocando um valor **abaixo** do já pago, não gera erro
- [ ] Consulta pelo MCP: nenhuma linha com `pago = true and saldo_devedor > 0`, nem `pago = false and saldo_devedor = 0`
- [ ] `npm run build` e `npm run lint` passam

**Estado intermediário aceito:** enquanto os tickets 03–06 não subirem, Vencimentos e Dashboard ainda mostram o valor cheio dessa parcela. É o modo de falha conservador previsto na spec — superestima o a receber, nunca dá como paga uma parcela que não foi.
