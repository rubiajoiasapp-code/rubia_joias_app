# 04: Vencimentos mostra o saldo e conta os abatimentos no recebido

**O que construir:** a tela de Vencimentos passa a mostrar o que **falta** em cada parcela, e o total recebido do mês passa a incluir os abatimentos parciais.

Este ticket corrige um problema que a parcialidade cria em duas pontas ao mesmo tempo. Hoje [ExpirationDates.tsx](../../../src/pages/ExpirationDates.tsx) busca **todas** as parcelas — não filtra por `pago` — e deriva os totais assim: `totalPaid` soma `valor_parcela` das pagas, e `totalPending` é a subtração do total do mês. Com pagamento parcial isso erra dos dois lados: os R$ 45,68 de uma parcela ainda pendente **não entram no recebido**, e o pendente fica inflado pelo mesmo valor.

A correção deixa o cálculo mais simples que o atual, não mais complexo: o recebido do mês passa a somar `valor_pago` de todas as parcelas, e o pendente soma `saldo_devedor`. A subtração deixa de ser necessária.

Na listagem, a parcela parcial mostra o saldo. Ela continua com o status de pendente (ou atrasada, se for o caso) — o que é correto, já que ainda há dinheiro a receber nela.

**Bloqueado por:** 02 — Abater um valor de uma parcela no Crediário

**Status:** ready-for-agent

**Como verificar:**

- [ ] Numa parcela de R$ 100,00 com R$ 45,68 abatidos, `/vencimentos` lista o saldo **R$ 54,32**, não R$ 100,00
- [ ] O total recebido do mês **inclui** os R$ 45,68, mesmo com a parcela ainda pendente
- [ ] O total pendente do mês conta R$ 54,32 para essa parcela
- [ ] Recebido + pendente do mês continuam somando o total devido do mês
- [ ] A parcela parcial mantém o status visual de pendente; se estiver vencida, continua marcada como atrasada
- [ ] O botão "Marcar como Pago" numa parcela parcial a quita por inteiro e zera o saldo
- [ ] Um mês sem nenhuma parcela parcial mostra exatamente os mesmos números de antes da mudança
- [ ] `npm run build` e `npm run lint` passam
