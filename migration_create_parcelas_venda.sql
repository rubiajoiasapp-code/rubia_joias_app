-- =====================================================
-- Migration: Criar tabela parcelas_venda
-- =====================================================
-- Descrição: Cria tabela para armazenar parcelas de vendas parceladas (FIADO)
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Tabela de Parcelas de Venda
CREATE TABLE IF NOT EXISTS parcelas_venda (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    valor_parcela DECIMAL(10, 2) NOT NULL,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    pago BOOLEAN DEFAULT FALSE,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_parcelas_venda_venda_id ON parcelas_venda(venda_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_venda_pago ON parcelas_venda(pago);
CREATE INDEX IF NOT EXISTS idx_parcelas_venda_data_vencimento ON parcelas_venda(data_vencimento);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_parcelas_venda_updated_at
    BEFORE UPDATE ON parcelas_venda
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar resultado
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'parcelas_venda'
ORDER BY ordinal_position;
