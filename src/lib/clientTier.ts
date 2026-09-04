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
    valor_parcela: number;
    saldo_devedor: number;
}

const REDEMPTION_WINDOW = 3;

/**
 * Quanto do que está vencido já foi pago para a cliente merecer alívio de um nível.
 *
 * Quem pagou R$ 95 de uma parcela de R$ 100 vencida não é a mesma coisa que quem não
 * pagou nada — mas continua devendo, então a parcela segue contando como vencida; o que
 * muda é a gravidade. 70% é o ponto onde o comportamento já é claramente "está pagando"
 * e não "parou de pagar".
 *
 * Deliberadamente NÃO existe piso por valor aqui. Ele rebaixaria clientes que apenas
 * devem pouco e não pagaram nada — inclusive uma cliente com R$ 100 e 101 dias de
 * atraso, onde o tempo é o sinal, não o valor.
 */
const ALIVIO_POR_PAGAMENTO_PARCIAL = 0.7;

/**
 * Interpreta 'AAAA-MM-DD' como meia-noite LOCAL.
 *
 * `new Date('2026-09-04')` não faz isso: o padrão manda tratar data sem hora como UTC,
 * que em Brasília (UTC-3) é 21h do dia 3. O resultado era um dia inteiro de erro — a
 * parcela que vencia hoje entrava como um dia em atraso, e 30 dias de atraso já
 * disparava o CRITICO reservado para "mais de 30". O resto do sistema compara essas
 * datas como texto ISO, que não tem esse problema; só a classificação divergia.
 */
function dataLocal(iso: string): Date {
    const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number);
    return new Date(ano, mes - 1, dia);
}

export function classifyClient(parcelas: ParcelaForTier[]): ClientTier {
    if (!parcelas || parcelas.length === 0) return 'NOVO';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const openParcelas = parcelas.filter(p => !p.pago);
    const openOverdue = openParcelas.filter(p => dataLocal(p.data_vencimento) < today);

    if (openOverdue.length > 0) {
        const maxDaysLate = openOverdue.reduce((max, p) => {
            const due = dataLocal(p.data_vencimento);
            const days = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
            return days > max ? days : max;
        }, 0);

        // Crédito por pagamento parcial: se a maior parte do que está vencido já entrou,
        // a cliente está pagando, não sumindo — a gravidade cai um nível.
        const totalVencido = openOverdue.reduce((s, p) => s + Number(p.valor_parcela ?? 0), 0);
        const saldoVencido = openOverdue.reduce((s, p) => s + Number(p.saldo_devedor ?? p.valor_parcela ?? 0), 0);
        const proporcaoPaga = totalVencido > 0 ? 1 - saldoVencido / totalVencido : 0;
        const pagouAMaiorParte = proporcaoPaga >= ALIVIO_POR_PAGAMENTO_PARCIAL;

        if (maxDaysLate > 30) return pagouAMaiorParte ? 'ATENCAO' : 'CRITICO';
        // Em ATENCAO, o alívio deixa a classificação seguir para o histórico de
        // pagamentos abaixo — que decide entre EXCELENTE e BOM.
        if (!pagouAMaiorParte) return 'ATENCAO';
    }

    const paidParcelas = parcelas.filter(p => p.pago && p.data_pagamento);

    const wasLate = (p: ParcelaForTier): boolean =>
        dataLocal(p.data_pagamento as string) > dataLocal(p.data_vencimento);

    const everLate = paidParcelas.some(wasLate);
    if (!everLate) return 'EXCELENTE';

    // Client was late at least once — check for redemption.
    // If the most recent REDEMPTION_WINDOW paid parcelas were ALL on time,
    // consider the client rehabilitated and promote back to EXCELENTE.
    const recentPaid = [...paidParcelas]
        .sort(
            (a, b) =>
                dataLocal(b.data_pagamento as string).getTime() -
                dataLocal(a.data_pagamento as string).getTime(),
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
        .select('pago, data_vencimento, data_pagamento, valor_parcela, saldo_devedor, venda:vendas(cliente_id)');

    if (error) {
        console.error('Error fetching parcelas for tier classification:', error);
        return {};
    }

    const byClient: Record<string, ParcelaForTier[]> = {};
    for (const row of (data || []) as unknown as Array<{
        pago: boolean;
        data_vencimento: string;
        data_pagamento: string | null;
        valor_parcela: number;
        saldo_devedor: number;
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
            valor_parcela: Number(row.valor_parcela),
            saldo_devedor: Number(row.saldo_devedor),
        });
    }

    const result: Record<string, ClientTier> = {};
    for (const [clientId, parcelas] of Object.entries(byClient)) {
        result[clientId] = classifyClient(parcelas);
    }
    return result;
}
