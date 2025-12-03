# 🔔 Configuração de Lembretes Automáticos via WhatsApp

Este guia mostra como configurar os lembretes automáticos de parcelas vencendo via WhatsApp usando a API CallMeBot.

## 📋 Pré-requisitos

- ✅ Aplicação rodando e acessível
- ✅ Conta no Supabase com o projeto configurado
- ✅ WhatsApp instalado no celular

---

## 🚀 Passo a Passo

### 1️⃣ Executar a Migração do Banco de Dados

1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie todo o conteúdo do arquivo `migration_create_notification_settings.sql`
6. Cole no editor e clique em **Run**
7. Verifique se a execução foi bem-sucedida ✅

### 2️⃣ Obter API Key do CallMeBot

1. **Adicione o número do CallMeBot aos seus contatos:**
   - Número: `+34 644 44 89 77`
   - Nome do contato: `CallMeBot API`

2. **Envie a mensagem de ativação:**
   - Abra o WhatsApp
   - Encontre o contato `CallMeBot API`
   - Envie exatamente esta mensagem:
     ```
     I allow callmebot to send me messages
     ```

3. **Aguarde a resposta:**
   - Você receberá uma resposta automática em alguns minutos
   - A mensagem conterá sua **API Key** (um código numérico)
   - **IMPORTANTE:** Guarde esta API Key, você precisará dela!

   Exemplo de resposta:
   ```
   Your API Key is: 123456
   ```

### 3️⃣ Configurar no Sistema

1. Acesse sua aplicação Rubia Joias
2. No menu lateral, clique em **⚙️ Configurações**
3. Na seção "Lembretes via WhatsApp", preencha:
   - **Número WhatsApp:** Seu número com DDI (ex: `5511999999999`)
     - Brasil = `55` + DDD + Número
   - **CallMeBot API Key:** A chave que você recebeu no WhatsApp
   - **Horário de Envio:** Escolha o horário diário (ex: `10:00`)
   - **Dias de Antecedência:** Selecione quais alertas deseja:
     - `3 dias antes` ⚠️
     - `2 dias antes` ⚠️
     - `No dia` 🔴
   - **Ativar Lembretes:** Ligue o toggle ✅
   - **Enviar em Finais de Semana:** Escolha se deseja receber aos sábados/domingos

4. Clique em **Salvar Configurações**

5. **Teste o envio:**
   - Clique no botão verde **Testar Envio**
   - Verifique se recebeu a mensagem de teste no WhatsApp
   - Se recebeu, está tudo funcionando! 🎉

---

### 4️⃣ Deploy da Edge Function (Opcional - para envio automático)

Para que os lembretes sejam enviados **automaticamente** todos os dias, você precisa fazer o deploy da Edge Function.

#### Opção A: Via Supabase CLI (Recomendado)

1. **Instale o Supabase CLI** (se ainda não tiver):
   ```bash
   npm install -g supabase
   ```

2. **Faça login:**
   ```bash
   supabase login
   ```

3. **Link seu projeto:**
   ```bash
   supabase link --project-ref SEU-PROJECT-REF
   ```
   > Encontre o `project-ref` na URL do Supabase Dashboard

4. **Deploy da função:**
   ```bash
   supabase functions deploy send-whatsapp-reminder
   ```

5. **Verifique o deploy:**
   - Acesse: Supabase Dashboard → Edge Functions
   - Você deve ver `send-whatsapp-reminder` listada

#### Opção B: Via Dashboard do Supabase

1. Acesse: Supabase Dashboard → Edge Functions
2. Clique em **Create a new function**
3. Nome: `send-whatsapp-reminder`
4. Copie o código do arquivo `supabase/functions/send-whatsapp-reminder/index.ts`
5. Cole no editor e clique em **Deploy**

---

### 5️⃣ Configurar Cron Job (Envio Automático Diário)

Para que a função execute automaticamente todos os dias:

1. Acesse: Supabase Dashboard → **Database** → **Cron Jobs**
2. Clique em **Create a cron job**
3. Preencha:
   - **Name:** `send-daily-whatsapp-reminders`
   - **Schedule:** `0 10 * * *` (10:00 AM todos os dias)
     - Ou ajuste conforme o horário que configurou na aplicação
   - **SQL:**
     ```sql
     select
       net.http_post(
         url := 'https://SEU-PROJECT-ID.supabase.co/functions/v1/send-whatsapp-reminder',
         headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU-ANON-KEY"}'::jsonb
       ) as request_id;
     ```
   
   > **Substitua:**
   > - `SEU-PROJECT-ID`: ID do seu projeto Supabase
   > - `SEU-ANON-KEY`: Sua chave anon/public (encontre em Project Settings → API)

4. Clique em **Create**
5. Cron job criado! ✅

---

## 🧪 Testando a Funcionalidade

### Teste Manual da Edge Function

1. Acesse: Supabase Dashboard → Edge Functions
2. Selecione `send-whatsapp-reminder`
3. Clique em **Invoke**
4. Deixe o corpo vazio `{}`
5. Clique em **Invoke**
6. Verifique seu WhatsApp para a mensagem

### Teste com Parcelas Reais

1. Crie algumas parcelas com vencimentos:
   - Uma para hoje
   - Uma para daqui 2 dias
   - Uma para daqui 3 dias
2. Execute a Edge Function manualmente (passo acima)
3. Você deve receber uma mensagem agrupada com todas as parcelas

---

## 📱 Formato da Mensagem Recebida

Você receberá mensagens no seguinte formato:

```
🔔 *LEMBRETES RUBIA JOIAS* - 03/12

🔴 *VENCENDO HOJE* (2):
• Maria Silva - R$ 150.00
• João Santos - R$ 200.00

⚠️ *VENCE EM 2 DIAS* (1):
• Ana Costa - R$ 300.00

📅 *VENCE EM 3 DIAS* (3):
• Pedro Lima - R$ 100.00
• Carla Souza - R$ 250.00
• Paulo Ramos - R$ 180.00

💰 *Total a receber:* R$ 1180.00

---
_Enviado automaticamente pelo sistema Rubia Joias_
```

---

## ⚙️ Personalizando o Horário de Envio

Você pode ajustar o horário de duas formas:

### Via Interface (Configurações)
1. Acesse **Configurações** na aplicação
2. Altere o campo "Horário de Envio"
3. Salvar
4. **IMPORTANTE:** Você também deve ajustar o Cron Job no Supabase para o mesmo horário!

### Via Cron Job (Supabase)
Edite o cron schedule usando formato `MIN HORA * * *`:
- `0 10 * * *` = 10:00 AM
- `0 14 * * *` = 14:00 (2:00 PM)
- `30 9 * * *` = 09:30 AM
- `0 20 * * *` = 20:00 (8:00 PM)

---

## ❗ Problemas Comuns

### Não recebi a API Key do CallMeBot
- Certifique-se de que salvou o contato corretamente
- Verifique se enviou a mensagem EXATAMENTE como indicado
- Aguarde até 10 minutos
- Se não funcionar, tente novamente

### Mensagem de teste falhou
- Verifique se o número está no formato correto (DDI + DDD + Número)
- Confirme que a API Key está correta
- Verifique sua conexão com a internet
- Tente novamente em alguns minutos

### Cron Job não está executando
- Verifique se o horário está no formato UTC (pode precisar ajustar)
- Confirme que a URL da Edge Function está correta
- Verifique os logs em: Database → Cron Jobs → View Logs

### Nenhuma mensagem foi enviada
- Verifique se há parcelas vencendo nas datas configuradas
- Confirme que "Ativar Lembretes" está ligado
- Verifique se hoje não é fim de semana (se desativou essa opção)
- Execute a Edge Function manualmente para ver os logs

---

## 🔒 Segurança

- ✅ A API Key do CallMeBot é armazenada de forma segura no Supabase
- ✅ Apenas você tem acesso às configurações
- ✅ As mensagens são enviadas apenas para o número configurado
- ⚠️ **Nunca compartilhe sua API Key do CallMeBot com terceiros**

---

## 📞 Suporte

Em caso de dúvidas:
1. Revise este guia
2. Verifique os logs da Edge Function no Supabase
3. Teste o envio manual primeiro antes de depender do automático

---

**Pronto! Seu sistema de lembretes automáticos está configurado! 🎉**
