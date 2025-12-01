# 🔧 Guia de Troubleshooting - Erro de Conexão

## ❌ Problema: "TypeError: Failed to fetch"

Este erro aparece ao tentar cadastrar **clientes** ou **produtos** e indica que **o frontend não consegue conectar ao Supabase**.

---

## 🎯 Solução

### 1️⃣ Verificar Credenciais do Supabase

O arquivo `.env` está com a chave **INCOMPLETA**:

```env
VITE_SUPABASE_ANON_KEY=sb_publishable_AXOZuc-Ap2wUxCH-IlWijg_zAhwsrHT
```

❌ **Essa chave está errada!** Uma chave válida tem mais de 100 caracteres.

### ✅ Como Pegar as Credenciais Corretas:

1. Acesse: https://supabase.com/dashboard/project/_
2. Vá em **Settings** → **API**
3. Copie os valores:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### 2️⃣ Atualizar o Arquivo `.env`

Edite o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://sua-url-aqui.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi... (chave completa)
```

> 💡 **Importante:** A chave `VITE_SUPABASE_ANON_KEY` deve começar com `eyJ` e ter mais de 100 caracteres!

### 3️⃣ Reiniciar o Servidor de Desenvolvimento

Após atualizar o `.env`, **REINICIE** o servidor:

1. Pare o servidor (Ctrl+C no terminal)
2. Execute novamente:
   ```bash
   npm run dev
   ```

---

## 🔍 Outras Verificações

### Projeto Pausado?
- Acesse o dashboard do Supabase
- Verifique se o projeto está **ativo** (não pausado)
- Se estiver pausado, clique em "Resume project"

### Tabelas Criadas?
Execute no **SQL Editor** do Supabase:

```sql
-- Verificar se tabela existe
SELECT * FROM clientes LIMIT 1;
SELECT * FROM produtos LIMIT 1;
```

Se der erro, execute os arquivos:
1. `schema.sql` (criar tabelas)
2. `migration_add_columns.sql` (adicionar colunas)

---

## 🧪 Teste Rápido de Conexão

No **Console do Navegador** (F12), execute:

```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key Length:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length);
```

✅ **Esperado:**
- URL deve ser uma URL válida do Supabase
- Key Length deve ser **maior que 100**

❌ **Se Key Length for pequeno (< 100):** A chave está incorreta!

---

## 📌 Resumo da Solução

1. ✅ Copie as credenciais corretas do Supabase Dashboard
2. ✅ Atualize o arquivo `.env` com a chave completa
3. ✅ Reinicie o servidor (`npm run dev`)
4. ✅ Teste cadastrar um cliente novamente
