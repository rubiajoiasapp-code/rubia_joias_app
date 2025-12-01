# Guia de Solução de Problemas - Rubia Joias

## Erro: "Erro ao cadastrar produto"

### Causa 1: Tabela 'produtos' não existe no banco
**Solução:**
1. Acesse o Supabase: https://grlnihdfzveqtlimeuax.supabase.co
2. Vá em **SQL Editor**
3. Copie todo o conteúdo do arquivo `schema.sql`
4. Cole no editor e clique em **RUN**
5. Aguarde a execução completar
6. Tente cadastrar o produto novamente

### Causa 2: Bucket de imagens não configurado
**Sintoma:** Produto não é cadastrado OU exibe aviso sobre imagem

**Solução:**
- Veja o arquivo `STORAGE_SETUP.md` para instruções
- OU continue sem imagens por enquanto (o app agora funciona sem o bucket)

### Causa 3: Erro de permissão (RLS)
**Sintoma:** Mensagem "new row violates row-level security policy"

**Solução:**
1. Acesse Supabase > **Authentication** > **Policies**
2. Vá para a tabela `produtos`
3. Clique em **New Policy**
4. Selecione **"Enable access to all users"** (para testes)
5. Ou execute este SQL:

```sql
-- Permitir INSERT para todos (temporário, para testes)
CREATE POLICY "Enable insert for all users" ON produtos
FOR INSERT WITH CHECK (true);

-- Permitir SELECT para todos
CREATE POLICY "Enable read access for all users" ON produtos
FOR SELECT USING (true);

-- Permitir DELETE para todos
CREATE POLICY "Enable delete for all users" ON produtos
FOR DELETE USING (true);
```

### Causa 4: Problemas com a estrutura da tabela
**Solução:** Recriar a tabela produtos com a estrutura correta

```sql
-- Apagar a tabela antiga (CUIDADO: isso apaga todos os dados!)
DROP TABLE IF EXISTS produtos CASCADE;

-- Recriar com a estrutura correta
CREATE TABLE produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE,
    descricao TEXT NOT NULL,
    categoria TEXT,
    valor_venda DECIMAL(10, 2) NOT NULL,
    quantidade_estoque INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Verificação Rápida

Execute este SQL para verificar se tudo está OK:

```sql
-- 1. Verificar se a tabela existe
SELECT * FROM produtos LIMIT 1;

-- 2. Verificar estrutura da tabela
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'produtos';

-- 3. Testar inserção manual
INSERT INTO produtos (codigo, descricao, categoria, valor_venda, quantidade_estoque)
VALUES ('12345678', 'Produto Teste', 'Teste', 100.00, 5);
```

Se todos os comandos acima funcionarem, o problema está resolvido!

## Ainda com problemas?

1. Abra o Console do navegador (F12)
2. Vá na aba "Console"
3. Tente cadastrar um produto
4. Copie a mensagem de erro vermelha que aparece
5. Me envie para análise
