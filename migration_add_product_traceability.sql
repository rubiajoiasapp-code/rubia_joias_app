-- Migration: Adicionar rastreabilidade de origem aos produtos
-- Vincula produtos à sua compra original (nota fiscal/fornecedor)

-- Adicionar coluna de referência à conta_pagar na tabela produtos
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS conta_pagar_id UUID REFERENCES contas_pagar(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_produtos_conta_pagar_id ON produtos(conta_pagar_id);

-- Comentários explicativos
COMMENT ON COLUMN produtos.conta_pagar_id IS 'Referência à compra original (nota fiscal/fornecedor) deste produto para rastreabilidade';
