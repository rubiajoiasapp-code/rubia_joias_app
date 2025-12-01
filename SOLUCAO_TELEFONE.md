# 🔧 Solução: Erro "telefone column not found"

## ❌ Problema

```
Could not find the 'telefone' column of 'clientes' in the schema cache
```

Esse erro acontece porque a **tabela `clientes` não tem a coluna `telefone`**, mas o código tenta salvar esse dado.

---

## ✅ Solução Rápida

### 1️⃣ Executar Migration SQL

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Vá em **SQL Editor** (menu lateral)
3. Clique em **New Query**
4. Cole o conteúdo do arquivo **`migration_add_telefone_clientes.sql`**
5. Clique em **RUN** (ou pressione Ctrl+Enter)

### 2️⃣ Verificar se Funcionou

Após executar, você verá uma mensagem de sucesso e uma tabela mostrando as colunas da tabela `clientes`, incluindo `telefone`.

### 3️⃣ Testar no App

Tente cadastrar um cliente novamente. Agora deve funcionar! ✅

---

## 📋 Conteúdo do Migration (caso queira executar manualmente)

Se preferir, você pode executar este comando SQL direto:

```sql
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
```

---

## 🔍 Verificar Todas as Colunas

Para ver todas as colunas da tabela `clientes`, execute:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clientes'
ORDER BY ordinal_position;
```

**Esperado:**
- id
- nome
- cpf
- endereco
- telefone ✅
- created_at

---

## 🎯 Resumo

1. ✅ Execute `migration_add_telefone_clientes.sql` no Supabase SQL Editor
2. ✅ Verifique se a coluna foi adicionada
3. ✅ Teste cadastrar um cliente

Pronto! O erro deve desaparecer. 🚀
