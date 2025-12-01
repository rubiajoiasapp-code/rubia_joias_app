-- Add valor_custo to produtos table
ALTER TABLE produtos 
ADD COLUMN IF NOT EXISTS valor_custo DECIMAL(10, 2) DEFAULT 0;
