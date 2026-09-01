# 05: "A receber" do Dashboard conta pelo saldo

**O que construir:** o fluxo de caixa do Dashboard deixa de inflar com dinheiro que já entrou.

Hoje [Dashboard.tsx](../../../src/pages/Dashboard.tsx) busca as parcelas pendentes e as distribui em três baldes — atrasadas, próximos 7 dias e próximos 30 dias — somando `valor_parcela` em cada um. Uma parcela de R$ 100,00 com R$ 45,68 já recebidos entra inteira, e o "Saldo Projetado (30d)" fica otimista.

Duas mudanças, e a primeira é fácil de esquecer: o `select` **hoje não traz `saldo_devedor`** — busca apenas `valor_parcela, data_vencimento, pago`. Não basta trocar a soma; a coluna precisa entrar na consulta.

O filtro `.eq('pago', false)` **continua correto e não muda**: parcela parcial segue pendente e deve mesmo contar no a receber, pelo que falta.

**Bloqueado por:** 02 — Abater um valor de uma parcela no Crediário

**Status:** ready-for-agent

**Como verificar:**

- [ ] Com uma parcela de R$ 100,00 e R$ 45,68 abatidos, vencendo dentro de 30 dias, o "A Receber (30d)" conta **R$ 54,32** para ela
- [ ] Se essa parcela estiver vencida, o total de atrasadas conta R$ 54,32, não R$ 100,00
- [ ] A contagem de parcelas pendentes **não muda** — a parcela parcial continua sendo uma parcela pendente
- [ ] O "Saldo Projetado (30d)" reflete o novo a receber
- [ ] Sem nenhuma parcela parcial no banco, todos os números do Dashboard ficam idênticos aos de antes da mudança
- [ ] `npm run build` e `npm run lint` passam
