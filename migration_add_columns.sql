-- ============================================
-- MIGRATION: Adicionar colunas faltantes na tabela produtos
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. Adicionar coluna 'codigo' (código único do produto para QR Code)
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;

-- 2. Adicionar coluna 'categoria' (categoria do produto)
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS categoria TEXT;

-- 3. Adicionar coluna 'image_url' (URL da imagem do produto)
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================
-- Verificação: Execute este SELECT para confirmar
-- ============================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'produtos'
ORDER BY ordinal_position;

-- Você deve ver as colunas: id, codigo, descricao, categoria, valor_venda, quantidade_estoque, image_url, created_at
