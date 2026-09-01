-- migration_fix_storage_policies.sql
--
-- Restringe a ESCRITA no bucket `product-images` a usuarios autenticados.
--
-- CONTEXTO
-- migration_enable_rls.sql cobriu o schema `public`. O Storage tem RLS proprio, em
-- storage.objects, e ficou de fora. As policies que existiam liberavam as quatro
-- operacoes para o papel `public` (que inclui `anon`), com a unica condicao de ser o
-- bucket certo:
--
--     DELETE -> public   USING (bucket_id = 'product-images')
--     INSERT -> public   WITH CHECK (bucket_id = 'product-images')
--     UPDATE -> public   USING (bucket_id = 'product-images')
--     SELECT -> public   USING (bucket_id = 'product-images')
--
-- Ou seja, qualquer pessoa com a chave anon — que vai publicada no bundle JS — podia
-- apagar as 795 fotos do estoque, troca-las por outras, ou encher a cota de 1 GB.
--
-- O QUE MUDA
-- - SELECT continua em `public`, DE PROPOSITO: o bucket e publico e /catalogo e aberto.
--   Manter a leitura evita qualquer risco de imagem sumir do catalogo.
-- - INSERT/UPDATE/DELETE passam a exigir `authenticated`. Quem cadastra e edita produto
--   ja esta logado (Inventory fica atras de ProtectedRoute), entao nada muda para a dona.
-- - `service_role` ignora RLS, entao os scripts de manutencao em scripts/ seguem
--   funcionando (e sao a unica forma de rodar limpeza/compressao).
--
-- Roda em uma transacao e e idempotente.

BEGIN;

-- As antigas tinham nome gerado ("product-images 16wiy3a_0" ... "_3"). Removidas pelo
-- nome exato; os DROPs sao IF EXISTS para a migration poder rodar de novo sem erro.
DROP POLICY IF EXISTS "product-images 16wiy3a_0" ON storage.objects;
DROP POLICY IF EXISTS "product-images 16wiy3a_1" ON storage.objects;
DROP POLICY IF EXISTS "product-images 16wiy3a_2" ON storage.objects;
DROP POLICY IF EXISTS "product-images 16wiy3a_3" ON storage.objects;

DROP POLICY IF EXISTS product_images_leitura_publica ON storage.objects;
DROP POLICY IF EXISTS product_images_insert_autenticado ON storage.objects;
DROP POLICY IF EXISTS product_images_update_autenticado ON storage.objects;
DROP POLICY IF EXISTS product_images_delete_autenticado ON storage.objects;

-- Leitura: aberta. O catalogo publico depende disso.
CREATE POLICY product_images_leitura_publica
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'product-images');

-- Escrita: so quem esta logado.
CREATE POLICY product_images_insert_autenticado
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'product-images');

CREATE POLICY product_images_update_autenticado
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'product-images')
    WITH CHECK (bucket_id = 'product-images');

CREATE POLICY product_images_delete_autenticado
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'product-images');

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICACAO — esperado: SELECT em {public}, os outros tres em {authenticated}
-- ---------------------------------------------------------------------------
-- SELECT policyname, cmd, roles
--   FROM pg_policies
--  WHERE schemaname = 'storage' AND tablename = 'objects'
--  ORDER BY cmd;

-- ---------------------------------------------------------------------------
-- ROLLBACK (volta ao estado anterior — inseguro)
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DROP POLICY IF EXISTS product_images_insert_autenticado ON storage.objects;
-- DROP POLICY IF EXISTS product_images_update_autenticado ON storage.objects;
-- DROP POLICY IF EXISTS product_images_delete_autenticado ON storage.objects;
-- CREATE POLICY "product-images 16wiy3a_1" ON storage.objects FOR INSERT TO public
--     WITH CHECK (bucket_id = 'product-images');
-- CREATE POLICY "product-images 16wiy3a_2" ON storage.objects FOR UPDATE TO public
--     USING (bucket_id = 'product-images');
-- CREATE POLICY "product-images 16wiy3a_3" ON storage.objects FOR DELETE TO public
--     USING (bucket_id = 'product-images');
-- COMMIT;
