# 03: Lembrete do WhatsApp cobra pelo saldo

**O que construir:** o lembrete automático passa a cobrar o que **falta**, não o valor cheio da parcela.

Hoje a Edge Function [send-whatsapp-reminder](../../../supabase/functions/send-whatsapp-reminder/index.ts) busca as parcelas com `pago = false` que vencem nas datas configuradas e monta a mensagem somando `valor_parcela`. Com pagamento parcial, ela passaria a cobrar R$ 100,00 de uma cliente que já pagou R$ 45,68.

O filtro `pago = false` **continua correto e não muda** — uma parcela parcial segue pendente e deve mesmo ser lembrada. O que muda é o valor exibido por parcela e o "Total a receber" da mensagem, que passam a usar `saldo_devedor`.

**Por que este é o primeiro depois da bala traçante:** é a única falha da lista que atinge a **cliente**, não os números internos da loja. Cobrar alguém pelo que ela já pagou é constrangedor para as duas, e desfaz a confiança que o crediário depende. Os outros tickets erram só para dentro. **Deve subir junto com o 02**, não depois.

Atenção ao deploy: a Edge Function **não vai no push da `main`**. Ela é publicada à parte, pelo Supabase CLI — ver [SETUP_WHATSAPP_REMINDERS.md](../../../SETUP_WHATSAPP_REMINDERS.md).

**Bloqueado por:** 02 — Abater um valor de uma parcela no Crediário

**Status:** ready-for-agent

**Como verificar:**

A função pode ser invocada manualmente; a resposta traz `mensagem_enviada`, o que permite conferir o texto sem depender de uma parcela vencer hoje.

- [ ] Com uma parcela de R$ 100,00 que recebeu abatimento de R$ 45,68 e vence numa das datas de alerta, a mensagem mostra **R$ 54,32** para aquela cliente
- [ ] O "Total a receber" da mensagem soma os saldos, não os valores cheios
- [ ] Uma parcela sem abatimento continua aparecendo pelo valor integral — comportamento inalterado
- [ ] Uma parcela quitada por abatimentos sucessivos **não** aparece na mensagem
- [ ] A função foi publicada pelo Supabase CLI e a versão em produção é a nova

**Se der errado:** o pior caso é a mensagem sair com o valor antigo — sem perda de dado e sem afetar o app. Reverter é republicar a versão anterior da função.
