-- Migration to add missing columns for Financial module

-- 1. Add columns to 'fornecedores' table
ALTER TABLE fornecedores 
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT;

-- 2. Add columns to 'contas_pagar' table
ALTER TABLE contas_pagar 
ADD COLUMN IF NOT EXISTS numero_nota_fiscal TEXT,
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT CHECK (forma_pagamento IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'FIADO', 'BOLETO'));

-- Note: Added 'BOLETO' as it is common for accounts payable, though user said "SAME AS SALES", sales usually don't have boleto for small businesses but suppliers often do. 
-- If strict adherence to sales payment methods is required, I will stick to the previous list. 
-- User said: "FORMA DE PAGAMENTO (IGUAL A DE VENDA)". 
-- Sales payment methods: 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'FIADO'.
-- I will strictly follow the user request and use the same check constraint, but I will drop the check constraint first to be safe if I need to modify it later.

ALTER TABLE contas_pagar 
DROP CONSTRAINT IF EXISTS contas_pagar_forma_pagamento_check;

ALTER TABLE contas_pagar
ADD CONSTRAINT contas_pagar_forma_pagamento_check 
CHECK (forma_pagamento IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'FIADO'));
