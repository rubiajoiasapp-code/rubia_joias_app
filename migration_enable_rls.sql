-- migration_enable_rls.sql
--
-- Liga Row Level Security nas 9 tabelas do schema public.
--
-- CONTEXTO
-- Hoje o papel `anon` (a chave publicada no bundle JS) tem DELETE/INSERT/SELECT/
-- UPDATE/TRUNCATE em todas as tabelas, e nao existe nenhuma policy. Qualquer pessoa
-- com a chave anon le e altera clientes, vendas, parcelas e a chave da API do CallMeBot.
--
-- PRINCIPIO DESTA MIGRATION: nao derrubar o app.
-- As policies foram derivadas de TODAS as queries que o app faz hoje (src/pages/*,
-- src/lib/clientScore.ts, src/lib/clientTier.ts). O que muda para quem esta logado: nada.
--   * `authenticated` -> CRUD completo nas 9 tabelas (espelha exatamente o de hoje).
--   * `anon`          -> apenas leitura do catalogo publico, em colunas selecionadas.
--   * `service_role`  -> intocado; ignora RLS por natureza, entao a Edge Function
--                        send-whatsapp-reminder (que usa SUPABASE_SERVICE_ROLE_KEY)
--                        continua funcionando sem alteracao.
--
-- Por que `authenticated` recebe USING (true) e nao algo mais granular: nenhuma destas
-- tabelas tem coluna de dono (user_id/owner). E uma loja so, e todo usuario logado e a
-- propria dona. Qualquer policy por usuario quebraria o app hoje sem ganho real.
--
-- Tudo roda em UMA transacao: nao existe instante em que o RLS esteja ligado sem policy.
-- A migration e idempotente (pode rodar de novo sem erro).

BEGIN;

-- 1) Policies para `authenticated` + liga RLS + tira o acesso do `anon`.
DO $$
DECLARE
    t text;
    tabelas text[] := ARRAY[
        'clientes',
        'fornecedores',
        'produtos',
        'vendas',
        'itens_venda',
        'contas_pagar',
        'parcelas_pagar',
        'parcelas_venda',
        'configuracoes_notificacoes'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        -- Policy permissiva para usuario logado (mesmo poder que ele ja tem hoje).
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_all_' || t, t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
            'authenticated_all_' || t, t
        );

        -- Liga o RLS (a policy acima ja existe, entao ninguem fica sem acesso).
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        -- Sem grant, o RLS nem chega a ser avaliado para o anon. Remove tambem
        -- TRUNCATE/REFERENCES/TRIGGER, que hoje estao abertos.
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END LOOP;
END $$;

-- 2) Excecao: o catalogo publico (/catalogo) e lido sem login.
--    src/pages/Catalog.tsx filtra show_in_catalog = true AND quantidade_estoque > 0,
--    ordena por descricao e seleciona 7 colunas.
--
--    O grant por coluna e o que protege `valor_custo` e `conta_pagar_id`: a policy de RLS
--    filtra LINHAS, nao colunas — sem isso, um visitante do catalogo poderia ler o preco
--    de custo de cada peca. `show_in_catalog` entra no grant porque o Postgres exige
--    privilegio de SELECT tambem nas colunas usadas no WHERE.
GRANT SELECT (
    id,
    codigo,
    descricao,
    categoria,
    valor_venda,
    quantidade_estoque,
    image_url,
    show_in_catalog
) ON public.produtos TO anon;

DROP POLICY IF EXISTS anon_catalogo_produtos ON public.produtos;
CREATE POLICY anon_catalogo_produtos
    ON public.produtos
    FOR SELECT
    TO anon
    USING (show_in_catalog = true);

-- 3) Fecha o desvio pela view.
--    `lista_conferencia_estoque` (definida em schema.sql) pertence ao `postgres` e nao
--    tinha `security_invoker`. Views assim rodam com o privilegio do DONO, e o postgres
--    ignora RLS — entao o anon leria o estoque inteiro por ela, inclusive pecas fora do
--    catalogo, contornando a policy do passo 2. Pior: o anon tinha tambem INSERT/UPDATE/
--    DELETE/TRUNCATE na view, que e auto-atualizavel (SELECT simples de uma tabela so),
--    ou seja, dava para escrever em `produtos` atraves dela.
--
--    A view nao e usada em lugar nenhum do app (nenhuma referencia em src/), entao
--    revogar o acesso do anon nao quebra nada.
ALTER VIEW public.lista_conferencia_estoque SET (security_invoker = true);
REVOKE ALL ON public.lista_conferencia_estoque FROM anon;

-- 4) Defesa em profundidade: o anon nao precisa executar gerar_parcelas.
--    A funcao e SECURITY INVOKER, entao ja respeitaria o RLS; o app nunca a chama por RPC
--    (nao existe .rpc() em src/). `update_updated_at_column` fica intocada de proposito —
--    e funcao de trigger e nao depende deste grant para disparar.
REVOKE EXECUTE ON FUNCTION public.gerar_parcelas(UUID, DECIMAL, INTEGER, DATE) FROM anon;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICACAO (rode depois; deve retornar 9 linhas com rls = true)
-- ---------------------------------------------------------------------------
-- SELECT c.relname,
--        c.relrowsecurity AS rls,
--        (SELECT count(*) FROM pg_policies p
--          WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relkind = 'r'
--  ORDER BY c.relname;

-- ---------------------------------------------------------------------------
-- ROLLBACK (volta ao estado anterior — inseguro, use so se algo quebrar)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DO $$
-- DECLARE
--     t text;
--     tabelas text[] := ARRAY['clientes','fornecedores','produtos','vendas','itens_venda',
--                             'contas_pagar','parcelas_pagar','parcelas_venda',
--                             'configuracoes_notificacoes'];
-- BEGIN
--     FOREACH t IN ARRAY tabelas LOOP
--         EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--         EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_all_' || t, t);
--         EXECUTE format('GRANT ALL ON public.%I TO anon', t);
--     END LOOP;
-- END $$;
-- DROP POLICY IF EXISTS anon_catalogo_produtos ON public.produtos;
-- ALTER VIEW public.lista_conferencia_estoque SET (security_invoker = false);
-- GRANT ALL ON public.lista_conferencia_estoque TO anon;
-- GRANT EXECUTE ON FUNCTION public.gerar_parcelas(UUID, DECIMAL, INTEGER, DATE) TO anon;
-- COMMIT;
