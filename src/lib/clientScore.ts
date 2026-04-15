import { supabase } from './supabase';
import type { ClientTier } from './clientTier';

export interface ClientStats {
    totalGasto: number;
    numVendas: number;
    ultimaCompraISO: string | null;
}

export interface ScoreBreakdown {
    monetario: number;
    frequencia: number;
    recencia: number;
    pontualidade: number;
    total: number;
}

export interface ScoreBand {
    label: string;
    emoji: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
}

export function scoreBand(score: number): ScoreBand {
    if (score >= 90) {
        return {
            label: 'Cliente VIP',
            emoji: '👑',
            bgClass: 'bg-yellow-100',
            textClass: 'text-yellow-800',
            borderClass: 'border-yellow-400',
        };
    }
    if (score >= 75) {
        return {
            label: 'Excelente',
            emoji: '⭐',
            bgClass: 'bg-emerald-100',
            textClass: 'text-emerald-700',
            borderClass: 'border-emerald-400',
        };
    }
    if (score >= 60) {
        return {
            label: 'Muito Bom',
            emoji: '👍',
            bgClass: 'bg-blue-100',
            textClass: 'text-blue-700',
            borderClass: 'border-blue-400',
        };
    }
    if (score >= 40) {
        return {
            label: 'Regular',
            emoji: '🆗',
            bgClass: 'bg-sky-100',
            textClass: 'text-sky-700',
            borderClass: 'border-sky-400',
        };
    }
    if (score >= 20) {
        return {
            label: 'Fraco',
            emoji: '🔸',
            bgClass: 'bg-orange-100',
            textClass: 'text-orange-700',
            borderClass: 'border-orange-400',
        };
    }
    return {
        label: 'Inativo',
        emoji: '⚠️',
        bgClass: 'bg-gray-100',
        textClass: 'text-gray-600',
        borderClass: 'border-gray-400',
    };
}

// O score considera TODO o histórico desde a primeira venda da loja.
// Os pesos dão 95 pontos pra métricas cumulativas (monetário + frequência + pontualidade)
// e só 5 pontos pra recência, que é um bônus pequeno pra clientes ainda ativos.

function scoreMonetario(totalGasto: number, maxGasto: number): number {
    if (totalGasto <= 0 || maxGasto <= 0) return 0;
    // Escala logarítmica sobre o maior gastador histórico da loja.
    // log suaviza diferenças muito grandes — não é "razão linear" e sim progressão.
    const ratio = Math.log10(1 + totalGasto) / Math.log10(1 + maxGasto);
    return Math.round(Math.max(0, Math.min(1, ratio)) * 40);
}

function scoreFrequencia(numVendas: number): number {
    if (numVendas <= 0) return 0;
    if (numVendas === 1) return 8;
    if (numVendas <= 3) return 15;
    if (numVendas <= 6) return 22;
    if (numVendas <= 10) return 27;
    return 30;
}

function scoreRecencia(ultimaCompraISO: string | null): number {
    if (!ultimaCompraISO) return 0;
    const last = new Date(ultimaCompraISO);
    const now = new Date();
    const days = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    // Pequeno bônus pra clientes ativos. Dormentes não são punidos com 0 — o cumulativo já conta.
    if (days < 0) return 5;
    if (days <= 60) return 5;
    if (days <= 180) return 3;
    if (days <= 365) return 2;
    return 1;
}

function scorePontualidade(tier: ClientTier): number {
    switch (tier) {
        case 'EXCELENTE':
            return 25;
        case 'BOM':
            return 18;
        case 'NOVO':
            return 12;
        case 'ATENCAO':
            return 5;
        case 'CRITICO':
            return 0;
    }
}

export function computeScore(
    stats: ClientStats,
    tier: ClientTier,
    maxGastoGlobal: number,
): ScoreBreakdown {
    const monetario = scoreMonetario(stats.totalGasto, maxGastoGlobal);
    const frequencia = scoreFrequencia(stats.numVendas);
    const recencia = scoreRecencia(stats.ultimaCompraISO);
    const pontualidade = scorePontualidade(tier);
    const total = monetario + frequencia + recencia + pontualidade;
    return { monetario, frequencia, recencia, pontualidade, total };
}

export async function fetchClientStatsMap(): Promise<Record<string, ClientStats>> {
    const { data, error } = await supabase
        .from('vendas')
        .select('cliente_id, valor_total, data_venda')
        .not('cliente_id', 'is', null);

    if (error) {
        console.error('Error fetching client stats:', error);
        return {};
    }

    const byClient: Record<string, ClientStats> = {};
    for (const row of (data || []) as Array<{
        cliente_id: string;
        valor_total: number | string;
        data_venda: string;
    }>) {
        const id = row.cliente_id;
        if (!id) continue;
        if (!byClient[id]) {
            byClient[id] = { totalGasto: 0, numVendas: 0, ultimaCompraISO: null };
        }
        byClient[id].totalGasto += Number(row.valor_total) || 0;
        byClient[id].numVendas += 1;
        if (!byClient[id].ultimaCompraISO || row.data_venda > byClient[id].ultimaCompraISO!) {
            byClient[id].ultimaCompraISO = row.data_venda;
        }
    }
    return byClient;
}

export function maxGastoFromStats(statsMap: Record<string, ClientStats>): number {
    let max = 0;
    for (const s of Object.values(statsMap)) {
        if (s.totalGasto > max) max = s.totalGasto;
    }
    return max;
}
