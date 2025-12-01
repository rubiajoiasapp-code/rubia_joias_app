-- ============================================
-- SUPABASE STORAGE CONFIGURATION
-- Bucket para Imagens de Produtos
-- ============================================

-- 1. Criar o bucket 'product-images' (público)
-- Você pode executar este SQL no SQL Editor do Supabase:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,  -- Bucket público
  5242880,  -- Limite de 5MB por arquivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']  -- Tipos permitidos
);

-- ============================================
-- 2. Políticas de Acesso (Storage Policies)
-- ============================================

-- Permitir que qualquer pessoa visualize as imagens (leitura pública)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Permitir que usuários autenticados façam upload de imagens
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Permitir que usuários autenticados atualizem suas imagens
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- Permitir que usuários autenticados deletem imagens
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-images' AND auth.role() = 'authenticated');

-- ============================================
-- ALTERNATIVA: Se você quiser permitir acesso sem autenticação
-- (útil para testes ou aplicações sem login)
-- ============================================

-- Descomente as políticas abaixo se quiser permitir upload sem autenticação:

-- CREATE POLICY "Anyone can upload images"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'product-images');

-- CREATE POLICY "Anyone can update images"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'product-images');

-- CREATE POLICY "Anyone can delete images"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'product-images');
