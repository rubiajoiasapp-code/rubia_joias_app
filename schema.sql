-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    endereco TEXT,
    cpf TEXT UNIQUE,
    telefone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    contato TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Produtos
CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo TEXT UNIQUE,
    descricao TEXT NOT NULL,
    categoria TEXT,
    valor_venda DECIMAL(10, 2) NOT NULL,
    quantidade_estoque INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Vendas
CREATE TABLE IF NOT EXISTS vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id),
    data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valor_total DECIMAL(10, 2) NOT NULL,
    forma_pagamento TEXT CHECK (forma_pagamento IN ('DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'FIADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Itens da Venda
CREATE TABLE IF NOT EXISTS itens_venda (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES produtos(id),
    quantidade INTEGER NOT NULL,
    valor_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED
);

-- 6. Contas a Pagar (Compras de Fornecedores)
CREATE TABLE IF NOT EXISTS contas_pagar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID REFERENCES fornecedores(id),
    descricao TEXT NOT NULL,
    valor_total DECIMAL(10, 2) NOT NULL,
    numero_parcelas INTEGER NOT NULL DEFAULT 1,
    data_compra DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Parcelas a Pagar
CREATE TABLE IF NOT EXISTS parcelas_pagar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conta_pagar_id UUID REFERENCES contas_pagar(id) ON DELETE CASCADE,
    numero_parcela INTEGER NOT NULL,
    valor_parcela DECIMAL(10, 2) NOT NULL,
    data_vencimento DATE NOT NULL,
    pago BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Feature: Lista de Conferência de Estoque
-- security_invoker: sem isso a view roda com o privilégio do dono (postgres), que ignora
-- RLS — viraria um desvio para ler produtos inteiros sem passar pelas policies.
CREATE OR REPLACE VIEW lista_conferencia_estoque
WITH (security_invoker = true) AS
SELECT 
    descricao AS produto,
    quantidade_estoque AS quantidade_atual
FROM 
    produtos
ORDER BY 
    descricao;

-- Função auxiliar para gerar parcelas (Lógica solicitada)
-- Exemplo de uso: SELECT gerar_parcelas('UUID_DA_CONTA', 1000.00, 5, '2023-10-01');
CREATE OR REPLACE FUNCTION gerar_parcelas(
    p_conta_pagar_id UUID,
    p_valor_total DECIMAL,
    p_numero_parcelas INTEGER,
    p_primeiro_vencimento DATE
) RETURNS VOID AS $$
DECLARE
    v_valor_parcela DECIMAL;
    v_data_vencimento DATE;
    i INTEGER;
BEGIN
    v_valor_parcela := p_valor_total / p_numero_parcelas;
    v_data_vencimento := p_primeiro_vencimento;

    FOR i IN 1..p_numero_parcelas LOOP
        INSERT INTO parcelas_pagar (conta_pagar_id, numero_parcela, valor_parcela, data_vencimento)
        VALUES (p_conta_pagar_id, i, v_valor_parcela, v_data_vencimento);
        
        -- Incrementa 1 mês para a próxima parcela
        v_data_vencimento := v_data_vencimento + INTERVAL '1 month';
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Aplicado por migration_enable_rls.sql. Mantido aqui porque schema.sql é o canônico.
--
-- Modelo: `authenticated` tem CRUD completo (é uma loja só; todo usuário logado é a
-- dona, e nenhuma tabela tem coluna de dono). `anon` só enxerga o catálogo público.
-- `service_role` ignora RLS, então a Edge Function send-whatsapp-reminder não muda.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    t text;
    tabelas text[] := ARRAY[
        'clientes', 'fornecedores', 'produtos', 'vendas', 'itens_venda',
        'contas_pagar', 'parcelas_pagar', 'parcelas_venda', 'configuracoes_notificacoes'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_all_' || t, t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            'authenticated_all_' || t, t
        );
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END LOOP;
END $$;

-- Catálogo público (/catalogo, sem login). O GRANT por coluna é o que protege
-- valor_custo e conta_pagar_id: a policy filtra linhas, não colunas.
-- show_in_catalog entra na lista porque o Postgres exige SELECT nas colunas do WHERE.
GRANT SELECT (
    id, codigo, descricao, categoria, valor_venda, quantidade_estoque, image_url, show_in_catalog
) ON public.produtos TO anon;

DROP POLICY IF EXISTS anon_catalogo_produtos ON public.produtos;
CREATE POLICY anon_catalogo_produtos
    ON public.produtos FOR SELECT TO anon
    USING (show_in_catalog = true);

REVOKE ALL ON public.lista_conferencia_estoque FROM anon;
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas(UUID, DECIMAL, INTEGER, DATE) FROM anon;
