-- migration_data_ultimo_pagamento.sql
--
-- `data_pagamento` passa a significar "data do ULTIMO pagamento recebido nesta parcela",
-- valendo tambem para pagamento parcial.
--
-- POR QUE
-- migration_add_pagamento_parcial.sql deixou `data_pagamento` como "quando quitou", e o
-- trigger a forcava a NULL enquanto houvesse saldo. Resultado: a dona registra que a
-- cliente pagou R$ 45,68 hoje e a tela nao mostra data nenhuma — a informacao existia so
-- no texto de `observacoes`, que e log interno e nao aparece para ela em lugar nenhum.
--
-- POR QUE NAO PRECISA DE COLUNA NOVA
-- clientTier.classifyClient so olha a data em parcelas com `pago = true`
-- (filtro `p.pago && p.data_pagamento`). Uma parcela parcial tem `pago = false`, entao
-- continua fora do calculo de pontualidade exatamente como antes. E numa parcela quitada
-- o ultimo pagamento E a quitacao, entao o significado antigo continua valendo la.
-- Ou seja: o score do cliente nao muda de comportamento.
--
-- REGRA
--   valor_pago == 0            -> data_pagamento = NULL   (nada foi recebido)
--   valor_pago AUMENTOU        -> data_pagamento = hoje   (entrou dinheiro agora)
--   valor_pago diminuiu/igual  -> data_pagamento preservada
--
-- Idempotente.

BEGIN;

CREATE OR REPLACE FUNCTION public.parcelas_venda_sincronizar_pagamento()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
    -- (a) Aparar antes de qualquer coisa. Cobre reduzir o valor da parcela abaixo do que
    --     ja foi pago — a edicao de parcela no Crediario permite isso.
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
        NEW.pago := (NEW.valor_pago >= NEW.valor_parcela);
    END IF;

    -- (d) data_pagamento = data do ULTIMO pagamento recebido (parcial ou total).
    --     Só avanca quando o valor_pago AUMENTA: aparar por reducao de valor_parcela
    --     nao e dinheiro entrando e nao deve mexer na data.
    IF NEW.valor_pago = 0 THEN
        NEW.data_pagamento := NULL;
    ELSIF TG_OP = 'INSERT' OR NEW.valor_pago > OLD.valor_pago THEN
        NEW.data_pagamento := v_hoje;
    ELSIF NEW.data_pagamento IS NULL THEN
        NEW.data_pagamento := v_hoje;
    END IF;

    -- `updated_at` NAO e tocado aqui: ja existe o trigger
    -- update_parcelas_venda_updated_at cuidando disso.
    RETURN NEW;
END;
$$;

-- Parcelas que ja receberam pagamento parcial e ficaram sem data.
-- Hoje isso atinge apenas as parcelas abatidas depois da migration anterior.
UPDATE public.parcelas_venda
   SET data_pagamento = (now() AT TIME ZONE 'America/Sao_Paulo')::date
 WHERE valor_pago > 0
   AND data_pagamento IS NULL;

COMMIT;

-- ---------------------------------------------------------------------------
-- VERIFICACAO — as duas contagens precisam voltar ZERO.
-- ---------------------------------------------------------------------------
-- SELECT
--   (SELECT count(*) FROM public.parcelas_venda WHERE valor_pago > 0 AND data_pagamento IS NULL) AS recebeu_sem_data,
--   (SELECT count(*) FROM public.parcelas_venda WHERE valor_pago = 0 AND data_pagamento IS NOT NULL) AS data_sem_recebimento;

-- ---------------------------------------------------------------------------
-- ROLLBACK — volta `data_pagamento` a significar apenas "quando quitou".
-- ---------------------------------------------------------------------------
-- Basta reaplicar o bloco (d) da versao anterior:
--   IF NEW.pago THEN
--       IF NEW.data_pagamento IS NULL THEN NEW.data_pagamento := v_hoje; END IF;
--   ELSE
--       NEW.data_pagamento := NULL;
--   END IF;
-- e rodar: UPDATE public.parcelas_venda SET data_pagamento = NULL WHERE NOT pago;
