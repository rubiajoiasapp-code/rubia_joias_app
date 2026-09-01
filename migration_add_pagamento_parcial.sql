-- migration_add_pagamento_parcial.sql
--
-- Permite registrar pagamento PARCIAL de uma parcela do crediario.
-- Ticket 01 de docs/issues/pagamento-parcial-parcela/
--
-- CONTEXTO
-- Hoje o pagamento e binario: `pago boolean` e `data_pagamento`, sem registro de quanto
-- foi pago. Quando a cliente paga R$ 45,68 de uma parcela de R$ 100,00, a dona so tem
-- duas saidas ruins: editar o valor da parcela (e o restante some da divida) ou
-- renegociar a venda inteira (que cancela TODAS as parcelas pendentes).
--
-- ESTA MIGRATION E UM NO-OP OBSERVAVEL
-- Ela e o passo `expand`: nenhuma tela muda de comportamento. Depois do backfill,
-- `saldo_devedor` de toda linha existente e exatamente o numero que o app ja soma hoje
-- (`valor_parcela` nas pendentes, que ficam com valor_pago = 0). Dashboard, Vencimentos,
-- Crediario e o lembrete do WhatsApp devolvem os mesmos valores de antes.
--
-- Isso e proposital: o schema e aplicado a mao no painel e o deploy dispara sozinho no
-- push da main, entao os dois acontecem em momentos diferentes. O codigo que consome
-- `saldo_devedor` vem depois, nos tickets 02-06.
--
-- NUMEROS DE REFERENCIA, medidos em 01/09/2026 antes de aplicar.
-- Depois de aplicar, precisam estar IDENTICOS (ver secao VERIFICACAO no fim):
--   Dashboard atrasadas .............  98 parcelas   R$ 11.212,72
--   Dashboard a receber 7d ..........  17 parcelas   R$  2.289,38
--   Dashboard a receber 30d ......... 103 parcelas   R$ 12.337,65
--   Vencimentos set/26 devido ....... 106 parcelas   R$ 12.885,79
--   Vencimentos set/26 recebido .....  18 parcelas   R$  2.018,59
--   Geral pago ...................... 554 parcelas   R$ 96.112,25
--   Geral pendente .................. 410 parcelas   R$ 55.453,62
--
-- Idempotente: pode rodar de novo sem erro.

BEGIN;

-- 1) Quanto ja foi pago desta parcela. Comeca em 0 para nao mudar nada.
ALTER TABLE public.parcelas_venda
    ADD COLUMN IF NOT EXISTS valor_pago numeric(10,2) NOT NULL DEFAULT 0;

-- 2) Backfill ANTES do CHECK: parcela paga passa a ter o valor cheio registrado.
UPDATE public.parcelas_venda
   SET valor_pago = CASE WHEN pago THEN valor_parcela ELSE 0 END
 WHERE valor_pago IS DISTINCT FROM (CASE WHEN pago THEN valor_parcela ELSE 0 END);

-- 3) Nunca pagar mais do que a parcela vale, nem valor negativo.
--    O trigger apara os casos limite antes deste CHECK rodar.
ALTER TABLE public.parcelas_venda
    DROP CONSTRAINT IF EXISTS parcelas_venda_valor_pago_valido;
ALTER TABLE public.parcelas_venda
    ADD CONSTRAINT parcelas_venda_valor_pago_valido
    CHECK (valor_pago >= 0 AND valor_pago <= valor_parcela);

-- 4) O saldo e DERIVADO — o banco calcula, nenhuma tela pode divergir em silencio.
ALTER TABLE public.parcelas_venda
    ADD COLUMN IF NOT EXISTS saldo_devedor numeric(10,2)
    GENERATED ALWAYS AS (valor_parcela - valor_pago) STORED;

-- 5) Trigger que mantem `pago` e `valor_pago` coerentes nos DOIS sentidos.
--
--    E o que permite as telas atuais continuarem escrevendo `pago` sem alteracao
--    nenhuma: Credit.handleTogglePaid, Credit.handleSaveInstallment e
--    ExpirationDates.handleMarkAsPaid seguem funcionando como sempre.
--
--    Nota: `saldo_devedor` e coluna gerada, entao dentro de um trigger BEFORE ela ainda
--    e NULL. Por isso as contas aqui usam valor_parcela - valor_pago diretamente.
CREATE OR REPLACE FUNCTION public.parcelas_venda_sincronizar_pagamento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- (a) Aparar antes de qualquer coisa. Cobre o caso real de reduzir o valor da
    --     parcela abaixo do que ja foi pago — a edicao de parcela no Crediario permite
    --     isso, e sem aparar o CHECK do passo 3 estouraria na cara da dona.
    IF NEW.valor_pago > NEW.valor_parcela THEN
        NEW.valor_pago := NEW.valor_parcela;
    END IF;
    IF NEW.valor_pago < 0 THEN
        NEW.valor_pago := 0;
    END IF;

    -- (b) Se `pago` foi escrito explicitamente, ele manda no valor.
    IF TG_OP = 'UPDATE' AND NEW.pago IS DISTINCT FROM OLD.pago THEN
        NEW.valor_pago := CASE WHEN NEW.pago THEN NEW.valor_parcela ELSE 0 END;

    ELSIF TG_OP = 'INSERT' AND NEW.pago AND NEW.valor_pago < NEW.valor_parcela THEN
        -- Entrada de venda e parcela de renegociacao nascem com pago = true.
        NEW.valor_pago := NEW.valor_parcela;

    ELSE
        -- (c) Caso contrario o valor manda: quitou quando nao sobra saldo.
        --     E por aqui que o abatimento parcial (ticket 02) quita a parcela sozinho.
        NEW.pago := (NEW.valor_pago >= NEW.valor_parcela);
    END IF;

    -- (d) `pago` implica `data_pagamento`. clientTier.classifyClient so considera a
    --     parcela no calculo de pontualidade quando os DOIS estao preenchidos, entao
    --     uma parcela paga sem data sumiria do score em silencio.
    --     Fuso explicito: o servidor nao roda no horario de Brasilia.
    IF NEW.pago THEN
        IF NEW.data_pagamento IS NULL THEN
            NEW.data_pagamento := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
        END IF;
    ELSE
        NEW.data_pagamento := NULL;
    END IF;

    -- `updated_at` NAO e tocado aqui: ja existe o trigger
    -- update_parcelas_venda_updated_at cuidando disso.
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parcelas_venda_sincronizar_pagamento ON public.parcelas_venda;
CREATE TRIGGER parcelas_venda_sincronizar_pagamento
    BEFORE INSERT OR UPDATE ON public.parcelas_venda
    FOR EACH ROW
    EXECUTE FUNCTION public.parcelas_venda_sincronizar_pagamento();

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICACAO 1 — invariantes. As tres contagens precisam voltar ZERO.
-- ---------------------------------------------------------------------------
-- SELECT
--   (SELECT count(*) FROM public.parcelas_venda WHERE valor_pago > valor_parcela)      AS pago_maior_que_parcela,
--   (SELECT count(*) FROM public.parcelas_venda WHERE pago = true  AND saldo_devedor > 0) AS paga_com_saldo,
--   (SELECT count(*) FROM public.parcelas_venda WHERE pago = false AND saldo_devedor = 0) AS pendente_sem_saldo,
--   (SELECT count(*) FROM public.parcelas_venda WHERE pago = true  AND data_pagamento IS NULL) AS paga_sem_data;

-- ---------------------------------------------------------------------------
-- VERIFICACAO 2 — neutralidade. Precisa bater com os numeros do cabecalho.
-- ---------------------------------------------------------------------------
-- WITH hoje AS (SELECT current_date AS d)
-- SELECT 'Dashboard: atrasadas' AS metrica,
--        count(*) FILTER (WHERE p.pago = false AND p.data_vencimento < h.d) AS qtd,
--        coalesce(sum(p.saldo_devedor) FILTER (WHERE p.pago = false AND p.data_vencimento < h.d), 0) AS valor
--   FROM public.parcelas_venda p CROSS JOIN hoje h
-- UNION ALL
-- SELECT 'Dashboard: a receber 30d',
--        count(*) FILTER (WHERE p.pago = false AND p.data_vencimento >= h.d AND p.data_vencimento <= h.d + 30),
--        coalesce(sum(p.saldo_devedor) FILTER (WHERE p.pago = false AND p.data_vencimento >= h.d AND p.data_vencimento <= h.d + 30), 0)
--   FROM public.parcelas_venda p CROSS JOIN hoje h
-- UNION ALL
-- SELECT 'Geral pendente', count(*) FILTER (WHERE NOT pago),
--        coalesce(sum(saldo_devedor) FILTER (WHERE NOT pago), 0) FROM public.parcelas_venda
-- UNION ALL
-- SELECT 'Geral pago', count(*) FILTER (WHERE pago),
--        coalesce(sum(valor_pago), 0) FROM public.parcelas_venda;

-- ---------------------------------------------------------------------------
-- ROLLBACK — devolve o estado binario sem perder nada.
-- `valor_parcela` e `pago` permanecem intactos o tempo todo.
-- ---------------------------------------------------------------------------
-- BEGIN;
-- DROP TRIGGER IF EXISTS parcelas_venda_sincronizar_pagamento ON public.parcelas_venda;
-- DROP FUNCTION IF EXISTS public.parcelas_venda_sincronizar_pagamento();
-- ALTER TABLE public.parcelas_venda DROP COLUMN IF EXISTS saldo_devedor;
-- ALTER TABLE public.parcelas_venda DROP CONSTRAINT IF EXISTS parcelas_venda_valor_pago_valido;
-- ALTER TABLE public.parcelas_venda DROP COLUMN IF EXISTS valor_pago;
-- COMMIT;
