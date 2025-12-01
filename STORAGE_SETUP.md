# Configuração do Supabase Storage - Guia Passo a Passo

## Opção 1: Via Interface Web (Recomendado)

### Passo 1: Acessar o Storage
1. Acesse seu projeto no Supabase: https://grlnihdfzveqtlimeuax.supabase.co
2. No menu lateral, clique em **Storage**

### Passo 2: Criar o Bucket
1. Clique no botão **"New bucket"** (ou "Novo bucket")
2. Preencha os campos:
   - **Name**: `product-images`
   - **Public bucket**: ✅ **Marque esta opção** (importante!)
   - **File size limit**: `5 MB` (opcional)
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif` (opcional)
3. Clique em **"Create bucket"**

### Passo 3: Configurar Políticas de Acesso
1. Com o bucket `product-images` selecionado, clique na aba **"Policies"**
2. Clique em **"New Policy"**
3. Selecione o template **"Allow public access"** para leitura
4. Para upload/delete, você pode:
   - Usar o template **"Allow authenticated users"** (usuários logados)
   - OU criar uma política customizada (veja a Opção 2 abaixo)

---

## Opção 2: Via SQL (Avançado)

Se preferir executar via SQL:

1. Acesse **SQL Editor** no Supabase
2. Copie e cole o conteúdo do arquivo `supabase-storage-setup.sql`
3. Execute o script

**Importante**: Se você estiver usando o app sem autenticação/login, descomente as políticas alternativas no final do arquivo SQL para permitir acesso público completo.

---

## Verificação

Após configurar, você pode testar:

1. Vá em **Storage** > **product-images**
2. Tente fazer upload manual de uma imagem de teste
3. Se aparecer a URL pública, está funcionando!

A URL das imagens seguirá o formato:
```
https://grlnihdfzveqtlimeuax.supabase.co/storage/v1/object/public/product-images/products/{nome-do-arquivo}
```

---

## Troubleshooting

### Erro: "new row violates row-level security policy"
- Significa que você precisa ajustar as políticas de acesso
- Se ainda não tem autenticação, use as políticas "Anyone can..." do arquivo SQL

### Erro: "Bucket not found"
- Verifique se o bucket foi criado corretamente
- Confirme que o nome é exatamente `product-images`

### Imagens não aparecem
- Verifique se o bucket está marcado como **público**
- Vá em Storage > product-images > Configuration > "Public bucket" deve estar ON
