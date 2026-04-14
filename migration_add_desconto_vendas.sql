-- Adiciona colunas de desconto à tabela vendas.
-- Seguro: ADD COLUMN IF NOT EXISTS é idempotente e não afeta linhas existentes
-- (vendas antigas ficam com NULL, que o frontend trata como "sem desconto").

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS desconto_percentual DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS desconto_valor DECIMAL(10, 2);
