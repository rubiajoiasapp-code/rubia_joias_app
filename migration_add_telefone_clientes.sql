-- =====================================================
-- Migration: Adicionar coluna 'telefone' na tabela clientes
-- =====================================================
-- Descrição: Adiciona a coluna telefone caso ela não exista
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Adicionar coluna telefone (se não existir)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'clientes' 
        AND column_name = 'telefone'
    ) THEN
        ALTER TABLE clientes ADD COLUMN telefone VARCHAR(20);
        RAISE NOTICE 'Coluna telefone adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna telefone já existe.';
    END IF;
END $$;

-- Verificar o resultado
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clientes'
ORDER BY ordinal_position;
