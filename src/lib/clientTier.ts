import { supabase } from './supabase';

export type ClientTier = 'EXCELENTE' | 'BOM' | 'ATENCAO' | 'CRITICO' | 'NOVO';

export interface TierInfo {
    label: string;
    short: string;
    emoji: string;
    description: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    rank: number;
}

export const TIER_INFO: Record<ClientTier, TierInfo> = {
    EXCELENTE: {
        label: 'Excelente pagador',
        short: 'Excelente',
        emoji: '🌟',
        description: 'Paga em dia. Nunca atrasou, ou recuperou a reputação pagando as últimas 3 parcelas no prazo.',
        bgClass: 'bg-emerald-100',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-400',
        rank: 0,
    },
    BOM: {
        label: 'Bom pagador',
        short: 'Bom',
        emoji: '👍',
        description: 'Quitou as pendências. Ainda tem histórico recente de atraso — paga as próximas em dia pra virar Excelente.',
        bgClass: 'bg-blue-100',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-400',
        rank: 1,
    },
    NOVO: {
        label: 'Cliente novo',
        short: 'Novo',
        emoji: '✨',
        description: 'Sem histórico de crediário. Primeira compra ou só compras à vista.',
        bgClass: 'bg-gray-100',
        textClass: 'text-gray-700',
        borderClass: 'border-gray-400',
        rank: 2,
    },
    ATENCAO: {
        label: 'Atenção — atraso recente',
        short: 'Atenção',
        emoji: '⚠️',
        description: 'Tem parcela em atraso (até 30 dias).',
        bgClass: 'bg-amber-100',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-500',
        rank: 3,
    },
    CRITICO: {
        label: 'Crítico — atraso longo',
        short: 'Crítico',
        emoji: '🚨',
        description: 'Tem parcela atrasada há mais de 30 dias. Cobrar antes de vender de novo.',
        bgClass: 'bg-red-100',
        textClass: 'text-red-700',
        borderClass: 'border-red-500',
        rank: 4,
    },
};

export interface ParcelaForTier {
    pago: boolean;
    data_vencimento: string;
    data_pagamento: string | null;
}

const REDEMPTION_WINDOW = 3;

export function classifyClient(parcelas: ParcelaForTier[]): ClientTier {
    if (!parcelas || parcelas.length === 0) return 'NOVO';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openParcelas = parcelas.filter(p => !p.pago);
    const openOverdue = openParcelas.filter(p => {
        const due = new Date(p.data_vencimento);
        due.setHours(0, 0, 0, 0);
        return due < today;
    });

    if (openOverdue.length > 0) {
        const maxDaysLate = openOverdue.reduce((max, p) => {
            const due = new Date(p.data_vencimento);
            due.setHours(0, 0, 0, 0);
            const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            return days > max ? days : max;
        }, 0);
        return maxDaysLate > 30 ? 'CRITICO' : 'ATENCAO';
    }

    const paidParcelas = parcelas.filter(p => p.pago && p.data_pagamento);

    const wasLate = (p: ParcelaForTier): boolean => {
        const paid = new Date(p.data_pagamento as string);
        const due = new Date(p.data_vencimento);
        paid.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);
        return paid > due;
    };

    const everLate = paidParcelas.some(wasLate);
    if (!everLate) return 'EXCELENTE';

    // Client was late at least once — check for redemption.
    // If the most recent REDEMPTION_WINDOW paid parcelas were ALL on time,
    // consider the client rehabilitated and promote back to EXCELENTE.
    const recentPaid = [...paidParcelas]
        .sort(
            (a, b) =>
                new Date(b.data_pagamento as string).getTime() -
                new Date(a.data_pagamento as string).getTime(),
        )
        .slice(0, REDEMPTION_WINDOW);

    if (recentPaid.length >= REDEMPTION_WINDOW && recentPaid.every(p => !wasLate(p))) {
        return 'EXCELENTE';
    }

    return 'BOM';
}

export function tierRank(tier: ClientTier): number {
    return TIER_INFO[tier].rank;
}

/**
 * Fetches all parcelas_venda joined with vendas and groups them by cliente_id,
 * returning a map of { [clienteId]: ClientTier }.
 */
export async function fetchClientTierMap(): Promise<Record<string, ClientTier>> {
    const { data, error } = await supabase
        .from('parcelas_venda')
        .select('pago, data_vencimento, data_pagamento, venda:vendas(cliente_id)');

    if (error) {
        console.error('Error fetching parcelas for tier classification:', error);
        return {};
    }

    const byClient: Record<string, ParcelaForTier[]> = {};
    for (const row of (data || []) as unknown as Array<{
        pago: boolean;
        data_vencimento: string;
        data_pagamento: string | null;
        venda: { cliente_id: string | null } | { cliente_id: string | null }[] | null;
    }>) {
        const vendaRef = Array.isArray(row.venda) ? row.venda[0] : row.venda;
        const clientId = vendaRef?.cliente_id;
        if (!clientId) continue;
        if (!byClient[clientId]) byClient[clientId] = [];
        byClient[clientId].push({
            pago: row.pago,
            data_vencimento: row.data_vencimento,
            data_pagamento: row.data_pagamento,
        });
    }

    const result: Record<string, ClientTier> = {};
    for (const [clientId, parcelas] of Object.entries(byClient)) {
        result[clientId] = classifyClient(parcelas);
    }
    return result;
}
