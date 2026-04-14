import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    DollarSign,
    TrendingUp,
    ShoppingBag,
    Package,
    Users,
    AlertCircle,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    Receipt,
    Scale,
    AlertTriangle,
    Flame,
    Trophy
} from 'lucide-react';
import {
    AreaChart,
    Area,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { todayLocalISO } from '../lib/format';
import { cacheGet, cacheSet } from '../lib/cache';

// ============ RANKING PERIOD ============

type RankingPeriod = 'mes' | 'trimestre' | 'semestre' | 'ano' | '2anos' | '3anos' | '4anos' | '5anos';

const RANKING_LABELS: Record<RankingPeriod, { label: string; title: string }> = {
    mes: { label: 'Mensal', title: 'do Mês' },
    trimestre: { label: 'Trimestral (3 meses)', title: 'do Trimestre' },
    semestre: { label: 'Semestral (6 meses)', title: 'do Semestre' },
    ano: { label: 'Anual', title: 'do Ano' },
    '2anos': { label: '2 Anos', title: 'dos Últimos 2 Anos' },
    '3anos': { label: '3 Anos', title: 'dos Últimos 3 Anos' },
    '4anos': { label: '4 Anos', title: 'dos Últimos 4 Anos' },
    '5anos': { label: '5 Anos', title: 'dos Últimos 5 Anos' }
};

const periodStartDate = (period: RankingPeriod): Date => {
    const now = new Date();
    switch (period) {
        case 'mes': return new Date(now.getFullYear(), now.getMonth(), 1);
        case 'trimestre': return new Date(now.getFullYear(), now.getMonth() - 2, 1);
        case 'semestre': return new Date(now.getFullYear(), now.getMonth() - 5, 1);
        case 'ano': return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case '2anos': return new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
        case '3anos': return new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
        case '4anos': return new Date(now.getFullYear() - 4, now.getMonth(), now.getDate());
        case '5anos': return new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    }
};

// ============ TYPES ============

interface KpiDelta {
    value: number;
    previous: number;
    deltaPct: number | null;
}

interface DashboardMetrics {
    // KPIs
    receita: KpiDelta;
    lucro: KpiDelta & { margem: number };
    ticketMedio: KpiDelta;
    aReceber30d: { total: number; quantidade: number };
    aPagar30d: { total: number; quantidade: number };
    saldoProjetado30d: number;

    // Alertas
    parcelasAtrasadas: { quantidade: number; total: number };
    parcelasSemana: { quantidade: number; total: number };
    fornecedoresSemana: { quantidade: number; total: number };
    produtosSemEstoque: number;

    // Gráficos
    receitaLucroMensal: { mes: string; receita: number; lucro: number; margem: number }[];
    mixPagamento: { metodo: string; valor: number; quantidade: number }[];

    // Rankings
    topClientes: { id: string; nome: string; total: number; compras: number }[];
    topProdutosLucro: {
        id: string;
        descricao: string;
        categoria: string;
        image_url: string | null;
        lucro: number;
        margem: number;
        qtd: number;
    }[];

    // Heatmap: 7 dias (0=Dom) × 12 slots de 2h (0=0h, 1=2h, ..., 11=22h)
    heatmap: number[][];
    heatmapMax: number;

    // Secundários
    vendasRecentes: VendaRecente[];
    produtosBaixoEstoque: ProdutoBaixoEstoque[];
    clientesTotal: number;
    novosMes: number;
    clientesAtivos: number;
}

interface VendaRecente {
    id: string;
    data_venda: string;
    valor_total: number;
    forma_pagamento: string;
    cliente?: { nome: string } | null;
}

interface ProdutoBaixoEstoque {
    id: string;
    descricao: string;
    categoria: string | null;
    quantidade_estoque: number;
}

// ============ HELPERS ============

const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatCurrency = (v: number): string =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const formatCompact = (v: number): string => {
    if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
    return `R$ ${v.toFixed(0)}`;
};

const deltaFrom = (current: number, previous: number): KpiDelta => {
    if (previous === 0) {
        return { value: current, previous, deltaPct: current > 0 ? 100 : null };
    }
    return {
        value: current,
        previous,
        deltaPct: ((current - previous) / previous) * 100
    };
};

// Gradient determinístico por nome (para avatar)
const avatarGradient = (name: string): string => {
    const gradients = [
        'from-pink-500 to-rose-600',
        'from-purple-500 to-indigo-600',
        'from-blue-500 to-cyan-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
        'from-red-500 to-pink-600',
        'from-violet-500 to-purple-600',
        'from-fuchsia-500 to-pink-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    return gradients[Math.abs(hash) % gradients.length];
};

const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatPaymentMethod = (method: string): string => {
    const map: Record<string, string> = {
        PIX: 'PIX',
        CARTAO_CREDITO: 'Crédito',
        CARTAO_DEBITO: 'Débito',
        DINHEIRO: 'Dinheiro',
        FIADO: 'Fiado'
    };
    return map[method] || method;
};

const PAYMENT_COLORS: Record<string, string> = {
    PIX: '#10B981',
    CARTAO_CREDITO: '#3B82F6',
    CARTAO_DEBITO: '#06B6D4',
    DINHEIRO: '#F59E0B',
    FIADO: '#EC4899'
};

const emptyMetrics: DashboardMetrics = {
    receita: { value: 0, previous: 0, deltaPct: null },
    lucro: { value: 0, previous: 0, deltaPct: null, margem: 0 },
    ticketMedio: { value: 0, previous: 0, deltaPct: null },
    aReceber30d: { total: 0, quantidade: 0 },
    aPagar30d: { total: 0, quantidade: 0 },
    saldoProjetado30d: 0,
    parcelasAtrasadas: { quantidade: 0, total: 0 },
    parcelasSemana: { quantidade: 0, total: 0 },
    fornecedoresSemana: { quantidade: 0, total: 0 },
    produtosSemEstoque: 0,
    receitaLucroMensal: [],
    mixPagamento: [],
    topClientes: [],
    topProdutosLucro: [],
    heatmap: Array.from({ length: 7 }, () => Array(12).fill(0)),
    heatmapMax: 0,
    vendasRecentes: [],
    produtosBaixoEstoque: [],
    clientesTotal: 0,
    novosMes: 0,
    clientesAtivos: 0
};

// ============ MAIN COMPONENT ============

const Dashboard: React.FC = () => {
    const initialCached = cacheGet<DashboardMetrics>('dashboard_metrics_v2');
    const [metrics, setMetrics] = useState<DashboardMetrics>(initialCached || emptyMetrics);
    const [loading, setLoading] = useState(!initialCached);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const mountedRef = useRef(true);

    // Ranking period selector — quando != 'mes', busca rankings separadamente
    const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>('mes');
    const [rankingOverride, setRankingOverride] = useState<{
        topClientes: DashboardMetrics['topClientes'];
        topProdutosLucro: DashboardMetrics['topProdutosLucro'];
    } | null>(null);
    const [loadingRanking, setLoadingRanking] = useState(false);

    useEffect(() => {
        mountedRef.current = true;
        fetchDashboardData();
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Refetch rankings quando o período muda
    useEffect(() => {
        if (rankingPeriod === 'mes') {
            // Volta a usar os rankings do fetchDashboardData (mês atual)
            setRankingOverride(null);
            return;
        }

        let cancelled = false;
        setLoadingRanking(true);

        (async () => {
            try {
                const start = formatLocalDate(periodStartDate(rankingPeriod));

                const [vendasRes, itensRes] = await Promise.all([
                    supabase
                        .from('vendas')
                        .select('id, valor_total, cliente_id, cliente:clientes(id, nome)')
                        .gte('data_venda', start),
                    supabase
                        .from('itens_venda')
                        .select(`
                            venda_id,
                            quantidade,
                            valor_unitario,
                            venda:vendas(data_venda),
                            produto:produtos(id, descricao, categoria, valor_custo, image_url)
                        `)
                        .gte('venda.data_venda', start)
                        .limit(20000)
                ]);

                if (cancelled) return;
                if (vendasRes.error) throw vendasRes.error;
                if (itensRes.error) throw itensRes.error;

                const vendas = (vendasRes.data || []) as any[];
                const itens = (itensRes.data || []) as any[];

                // Top clientes
                const clientesMap = new Map<string, { id: string; nome: string; total: number; compras: number }>();
                for (const v of vendas) {
                    const clienteNome = Array.isArray(v.cliente) ? v.cliente[0]?.nome : v.cliente?.nome;
                    if (!v.cliente_id || !clienteNome) continue;
                    const entry = clientesMap.get(v.cliente_id) || {
                        id: v.cliente_id,
                        nome: clienteNome,
                        total: 0,
                        compras: 0
                    };
                    entry.total += Number(v.valor_total) || 0;
                    entry.compras += 1;
                    clientesMap.set(v.cliente_id, entry);
                }
                const topClientes = Array.from(clientesMap.values())
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 5);

                // Top produtos por lucro
                const produtosMap = new Map<string, {
                    id: string;
                    descricao: string;
                    categoria: string;
                    image_url: string | null;
                    lucro: number;
                    receita: number;
                    qtd: number;
                }>();
                for (const item of itens) {
                    const produto = Array.isArray(item.produto) ? item.produto[0] : item.produto;
                    if (!produto) continue;
                    const qtd = Number(item.quantidade) || 0;
                    const valorUnit = Number(item.valor_unitario) || 0;
                    const custo = Number(produto.valor_custo) || 0;
                    const lucroItem = (valorUnit - custo) * qtd;
                    const receitaItem = valorUnit * qtd;
                    const existing = produtosMap.get(produto.id) || {
                        id: produto.id,
                        descricao: produto.descricao || 'Sem nome',
                        categoria: produto.categoria || '',
                        image_url: produto.image_url || null,
                        lucro: 0,
                        receita: 0,
                        qtd: 0
                    };
                    existing.lucro += lucroItem;
                    existing.receita += receitaItem;
                    existing.qtd += qtd;
                    produtosMap.set(produto.id, existing);
                }
                const topProdutosLucro = Array.from(produtosMap.values())
                    .map(p => ({
                        id: p.id,
                        descricao: p.descricao,
                        categoria: p.categoria,
                        image_url: p.image_url,
                        lucro: p.lucro,
                        margem: p.receita > 0 ? (p.lucro / p.receita) * 100 : 0,
                        qtd: p.qtd
                    }))
                    .sort((a, b) => b.lucro - a.lucro)
                    .slice(0, 5);

                if (!cancelled && mountedRef.current) {
                    setRankingOverride({ topClientes, topProdutosLucro });
                }
            } catch (err) {
                console.error('Erro ao buscar rankings:', err);
            } finally {
                if (!cancelled && mountedRef.current) setLoadingRanking(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [rankingPeriod]);

    const fetchDashboardData = async () => {
        try {
            const now = new Date();
            const hoje = todayLocalISO();
            const primeiroDiaMes = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
            const primeiroDiaMesAnterior = formatLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
            const seisMesesAtras = formatLocalDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
            const noventaDiasAtras = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90));
            const trintaDiasAtras = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
            const daqui30d = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30));
            const daqui7d = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));

            // Todas as queries em paralelo
            const [
                vendasJanelaRes,
                itensVendaRes,
                parcelasVendaRes,
                parcelasPagarRes,
                produtosBaixoEstoqueRes,
                vendasRecentesRes,
                clientesCountRes,
                novosMesCountRes,
                vendasRecentes30dRes
            ] = await Promise.all([
                supabase
                    .from('vendas')
                    .select('id, data_venda, valor_total, forma_pagamento, cliente_id, cliente:clientes(nome)')
                    .gte('data_venda', seisMesesAtras)
                    .order('data_venda', { ascending: false }),
                supabase
                    .from('itens_venda')
                    .select(`
                        venda_id,
                        produto_id,
                        quantidade,
                        valor_unitario,
                        venda:vendas(data_venda),
                        produto:produtos(id, descricao, categoria, valor_custo, image_url)
                    `)
                    .gte('venda.data_venda', primeiroDiaMesAnterior)
                    .limit(10000),
                supabase
                    .from('parcelas_venda')
                    .select('valor_parcela, data_vencimento, pago')
                    .eq('pago', false),
                supabase
                    .from('parcelas_pagar')
                    .select('valor_parcela, data_vencimento, pago')
                    .eq('pago', false),
                supabase
                    .from('produtos')
                    .select('id, descricao, categoria, quantidade_estoque')
                    .lte('quantidade_estoque', 3)
                    .order('quantidade_estoque', { ascending: true })
                    .limit(5),
                supabase
                    .from('vendas')
                    .select('id, data_venda, valor_total, forma_pagamento, cliente:clientes(nome)')
                    .order('data_venda', { ascending: false })
                    .limit(5),
                supabase
                    .from('clientes')
                    .select('*', { count: 'estimated', head: true }),
                supabase
                    .from('clientes')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', primeiroDiaMes),
                supabase
                    .from('vendas')
                    .select('cliente_id')
                    .gte('data_venda', trintaDiasAtras)
            ]);

            if (vendasJanelaRes.error) throw vendasJanelaRes.error;
            if (itensVendaRes.error) throw itensVendaRes.error;
            if (parcelasVendaRes.error) throw parcelasVendaRes.error;
            if (parcelasPagarRes.error) throw parcelasPagarRes.error;

            const vendas = (vendasJanelaRes.data || []) as any[];
            const itens = (itensVendaRes.data || []) as any[];
            const parcelasVenda = parcelasVendaRes.data || [];
            const parcelasPagar = parcelasPagarRes.data || [];
            const produtosBaixoEstoque = (produtosBaixoEstoqueRes.data || []) as ProdutoBaixoEstoque[];
            const vendasRecentes = (vendasRecentesRes.data || []) as unknown as VendaRecente[];

            // ---------- Receita e ticket médio por mês ----------
            const receitaPorMes = new Map<string, { receita: number; nVendas: number }>();
            for (const v of vendas) {
                const mesKey = String(v.data_venda).slice(0, 7); // YYYY-MM
                const valor = Number(v.valor_total) || 0;
                const entry = receitaPorMes.get(mesKey) || { receita: 0, nVendas: 0 };
                entry.receita += valor;
                entry.nVendas += 1;
                receitaPorMes.set(mesKey, entry);
            }

            const mesAtualKey = primeiroDiaMes.slice(0, 7);
            const mesAnteriorKey = primeiroDiaMesAnterior.slice(0, 7);
            const receitaMes = receitaPorMes.get(mesAtualKey)?.receita || 0;
            const nVendasMes = receitaPorMes.get(mesAtualKey)?.nVendas || 0;
            const receitaMesAnterior = receitaPorMes.get(mesAnteriorKey)?.receita || 0;
            const nVendasMesAnterior = receitaPorMes.get(mesAnteriorKey)?.nVendas || 0;

            const ticketMesAtual = nVendasMes > 0 ? receitaMes / nVendasMes : 0;
            const ticketMesAnterior = nVendasMesAnterior > 0 ? receitaMesAnterior / nVendasMesAnterior : 0;

            // ---------- Lucro por mês (usando itens com valor_custo) ----------
            // Indexa vendas por id → data_venda → mesKey
            const vendaMesMap = new Map<string, string>();
            for (const v of vendas) {
                vendaMesMap.set(v.id, String(v.data_venda).slice(0, 7));
            }

            const lucroPorMes = new Map<string, number>();
            const produtosLucroMap = new Map<string, {
                id: string;
                descricao: string;
                categoria: string;
                image_url: string | null;
                lucro: number;
                receita: number;
                qtd: number;
            }>();

            for (const item of itens) {
                const vendaId = item.venda_id;
                const mesKey = vendaMesMap.get(vendaId);
                if (!mesKey) continue;

                const produto = Array.isArray(item.produto) ? item.produto[0] : item.produto;
                if (!produto) continue;

                const qtd = Number(item.quantidade) || 0;
                const valorUnit = Number(item.valor_unitario) || 0;
                const custo = Number(produto.valor_custo) || 0;
                const lucroItem = (valorUnit - custo) * qtd;
                const receitaItem = valorUnit * qtd;

                lucroPorMes.set(mesKey, (lucroPorMes.get(mesKey) || 0) + lucroItem);

                // Acumula lucro por produto APENAS mês atual
                if (mesKey === mesAtualKey) {
                    const existing = produtosLucroMap.get(produto.id) || {
                        id: produto.id,
                        descricao: produto.descricao || 'Sem nome',
                        categoria: produto.categoria || '',
                        image_url: produto.image_url || null,
                        lucro: 0,
                        receita: 0,
                        qtd: 0
                    };
                    existing.lucro += lucroItem;
                    existing.receita += receitaItem;
                    existing.qtd += qtd;
                    produtosLucroMap.set(produto.id, existing);
                }
            }

            const lucroMes = lucroPorMes.get(mesAtualKey) || 0;
            const lucroMesAnterior = lucroPorMes.get(mesAnteriorKey) || 0;
            const margemMes = receitaMes > 0 ? (lucroMes / receitaMes) * 100 : 0;

            // ---------- Receita × Lucro últimos 6 meses ----------
            const receitaLucroMensal: DashboardMetrics['receitaLucroMensal'] = [];
            for (let i = 5; i >= 0; i--) {
                const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
                const r = receitaPorMes.get(key)?.receita || 0;
                const l = lucroPorMes.get(key) || 0;
                receitaLucroMensal.push({
                    mes: ref.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                    receita: r,
                    lucro: l,
                    margem: r > 0 ? (l / r) * 100 : 0
                });
            }

            // ---------- Fluxo de caixa (A Receber / A Pagar) ----------
            let aReceberTotal = 0;
            let aReceberQtd = 0;
            let atrasadasTotal = 0;
            let atrasadasQtd = 0;
            let semanaVendaTotal = 0;
            let semanaVendaQtd = 0;
            for (const p of parcelasVenda) {
                const vencimento = p.data_vencimento;
                const valor = Number(p.valor_parcela) || 0;
                if (vencimento < hoje) {
                    atrasadasTotal += valor;
                    atrasadasQtd += 1;
                } else if (vencimento <= daqui7d) {
                    semanaVendaTotal += valor;
                    semanaVendaQtd += 1;
                    aReceberTotal += valor;
                    aReceberQtd += 1;
                } else if (vencimento <= daqui30d) {
                    aReceberTotal += valor;
                    aReceberQtd += 1;
                }
            }

            let aPagarTotal = 0;
            let aPagarQtd = 0;
            let fornecedorSemanaTotal = 0;
            let fornecedorSemanaQtd = 0;
            for (const p of parcelasPagar) {
                const vencimento = p.data_vencimento;
                const valor = Number(p.valor_parcela) || 0;
                if (vencimento >= hoje && vencimento <= daqui30d) {
                    aPagarTotal += valor;
                    aPagarQtd += 1;
                    if (vencimento <= daqui7d) {
                        fornecedorSemanaTotal += valor;
                        fornecedorSemanaQtd += 1;
                    }
                }
            }

            const saldoProjetado30d = aReceberTotal - aPagarTotal;

            // ---------- Mix de pagamento (últimos 30 dias) ----------
            const mixMap = new Map<string, { valor: number; quantidade: number }>();
            for (const v of vendas) {
                const dataStr = String(v.data_venda).slice(0, 10);
                if (dataStr < trintaDiasAtras) continue;
                const metodo = v.forma_pagamento || 'OUTRO';
                const entry = mixMap.get(metodo) || { valor: 0, quantidade: 0 };
                entry.valor += Number(v.valor_total) || 0;
                entry.quantidade += 1;
                mixMap.set(metodo, entry);
            }
            const mixPagamento = Array.from(mixMap.entries())
                .map(([metodo, data]) => ({ metodo, valor: data.valor, quantidade: data.quantidade }))
                .sort((a, b) => b.valor - a.valor);

            // ---------- Top 5 clientes do mês ----------
            const clientesMap = new Map<string, { id: string; nome: string; total: number; compras: number }>();
            for (const v of vendas) {
                const dataStr = String(v.data_venda).slice(0, 10);
                if (dataStr < primeiroDiaMes) continue;
                const clienteNome = Array.isArray(v.cliente) ? v.cliente[0]?.nome : v.cliente?.nome;
                if (!v.cliente_id || !clienteNome) continue;
                const entry = clientesMap.get(v.cliente_id) || {
                    id: v.cliente_id,
                    nome: clienteNome,
                    total: 0,
                    compras: 0
                };
                entry.total += Number(v.valor_total) || 0;
                entry.compras += 1;
                clientesMap.set(v.cliente_id, entry);
            }
            const topClientes = Array.from(clientesMap.values())
                .sort((a, b) => b.total - a.total)
                .slice(0, 5);

            // ---------- Top 5 produtos por lucro (mês atual) ----------
            const topProdutosLucro = Array.from(produtosLucroMap.values())
                .map(p => ({
                    id: p.id,
                    descricao: p.descricao,
                    categoria: p.categoria,
                    image_url: p.image_url,
                    lucro: p.lucro,
                    margem: p.receita > 0 ? (p.lucro / p.receita) * 100 : 0,
                    qtd: p.qtd
                }))
                .sort((a, b) => b.lucro - a.lucro)
                .slice(0, 5);

            // ---------- Heatmap dia × hora (últimos 90 dias) ----------
            const heatmap: number[][] = Array.from({ length: 7 }, () => Array(12).fill(0));
            for (const v of vendas) {
                const dataStr = String(v.data_venda).slice(0, 10);
                if (dataStr < noventaDiasAtras) continue;
                const dt = new Date(v.data_venda);
                const diaSemana = dt.getDay(); // 0=dom, 6=sáb
                const hora = dt.getHours();
                const slot = Math.min(11, Math.floor(hora / 2));
                heatmap[diaSemana][slot] += Number(v.valor_total) || 0;
            }
            let heatmapMax = 0;
            for (const linha of heatmap) for (const v of linha) if (v > heatmapMax) heatmapMax = v;

            // ---------- Clientes ativos ----------
            const clientesAtivosSet = new Set<string>();
            (vendasRecentes30dRes.data || []).forEach((v: { cliente_id: string | null }) => {
                if (v.cliente_id) clientesAtivosSet.add(v.cliente_id);
            });

            const next: DashboardMetrics = {
                receita: deltaFrom(receitaMes, receitaMesAnterior),
                lucro: { ...deltaFrom(lucroMes, lucroMesAnterior), margem: margemMes },
                ticketMedio: deltaFrom(ticketMesAtual, ticketMesAnterior),
                aReceber30d: { total: aReceberTotal, quantidade: aReceberQtd },
                aPagar30d: { total: aPagarTotal, quantidade: aPagarQtd },
                saldoProjetado30d,
                parcelasAtrasadas: { quantidade: atrasadasQtd, total: atrasadasTotal },
                parcelasSemana: { quantidade: semanaVendaQtd, total: semanaVendaTotal },
                fornecedoresSemana: { quantidade: fornecedorSemanaQtd, total: fornecedorSemanaTotal },
                produtosSemEstoque: produtosBaixoEstoque.filter(p => p.quantidade_estoque === 0).length,
                receitaLucroMensal,
                mixPagamento,
                topClientes,
                topProdutosLucro,
                heatmap,
                heatmapMax,
                vendasRecentes,
                produtosBaixoEstoque,
                clientesTotal: clientesCountRes.count || 0,
                novosMes: novosMesCountRes.count || 0,
                clientesAtivos: clientesAtivosSet.size
            };

            if (!mountedRef.current) return;
            setMetrics(next);
            cacheSet('dashboard_metrics_v2', next);
        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            if (mountedRef.current) setErrorMsg('Não foi possível carregar os dados. ' + (error?.message || ''));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando dashboard...</p>
                </div>
            </div>
        );
    }

    if (errorMsg) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center max-w-md">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-700 mb-4">{errorMsg}</p>
                    <button
                        onClick={() => { setErrorMsg(null); setLoading(true); fetchDashboardData(); }}
                        className="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        );
    }

    const hasAnyAlert =
        metrics.parcelasAtrasadas.quantidade > 0 ||
        metrics.parcelasSemana.quantidade > 0 ||
        metrics.fornecedoresSemana.quantidade > 0 ||
        metrics.produtosSemEstoque > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                <p className="text-gray-600 mt-1 text-sm">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Alertas */}
            {hasAnyAlert && <AlertPanel metrics={metrics} />}

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <KpiCard
                    title="Receita do Mês"
                    value={formatCurrency(metrics.receita.value)}
                    delta={metrics.receita.deltaPct}
                    icon={DollarSign}
                    gradient="from-pink-500 to-rose-600"
                    subtitle={`${metrics.receita.previous > 0 ? 'vs ' + formatCompact(metrics.receita.previous) : 'sem dados anteriores'}`}
                />
                <KpiCard
                    title="Lucro Bruto do Mês"
                    value={formatCurrency(metrics.lucro.value)}
                    delta={metrics.lucro.deltaPct}
                    icon={TrendingUp}
                    gradient="from-emerald-500 to-teal-600"
                    subtitle={`Margem ${metrics.lucro.margem.toFixed(1)}%`}
                />
                <KpiCard
                    title="Ticket Médio"
                    value={formatCurrency(metrics.ticketMedio.value)}
                    delta={metrics.ticketMedio.deltaPct}
                    icon={Receipt}
                    gradient="from-violet-500 to-purple-600"
                    subtitle={`${metrics.ticketMedio.previous > 0 ? 'vs ' + formatCompact(metrics.ticketMedio.previous) : 'novo'}`}
                />
                <KpiCard
                    title="A Receber (30d)"
                    value={formatCurrency(metrics.aReceber30d.total)}
                    icon={Wallet}
                    gradient="from-blue-500 to-cyan-600"
                    subtitle={`${metrics.aReceber30d.quantidade} parcelas pendentes`}
                />
                <KpiCard
                    title="A Pagar (30d)"
                    value={formatCurrency(metrics.aPagar30d.total)}
                    icon={AlertCircle}
                    gradient="from-orange-500 to-amber-600"
                    subtitle={`${metrics.aPagar30d.quantidade} parcelas pendentes`}
                />
                <KpiCard
                    title="Saldo Projetado (30d)"
                    value={formatCurrency(metrics.saldoProjetado30d)}
                    icon={Scale}
                    gradient={metrics.saldoProjetado30d >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600'}
                    subtitle={metrics.saldoProjetado30d >= 0 ? 'Caixa positivo 🎉' : 'Atenção ao caixa'}
                />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Receita × Lucro */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Receita vs Lucro</h3>
                        <span className="text-xs text-gray-500">Últimos 6 meses</span>
                    </div>
                    <div style={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                            <AreaChart data={metrics.receitaLucroMensal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#EC4899" stopOpacity={0.6} />
                                        <stop offset="100%" stopColor="#EC4899" stopOpacity={0.05} />
                                    </linearGradient>
                                    <linearGradient id="lucroGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10B981" stopOpacity={0.6} />
                                        <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                                <YAxis
                                    tick={{ fontSize: 12, fill: '#6B7280' }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => formatCompact(v)}
                                />
                                <Tooltip content={<ReceitaLucroTooltip />} />
                                <Area type="monotone" dataKey="receita" stroke="#EC4899" strokeWidth={2.5} fill="url(#receitaGrad)" name="Receita" />
                                <Area type="monotone" dataKey="lucro" stroke="#10B981" strokeWidth={2.5} fill="url(#lucroGrad)" name="Lucro" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Mix de Pagamento */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Formas de Pagamento</h3>
                        <span className="text-xs text-gray-500">30 dias</span>
                    </div>
                    {metrics.mixPagamento.length === 0 ? (
                        <p className="text-center text-gray-400 py-16 text-sm">Sem vendas no período</p>
                    ) : (
                        <>
                            <div style={{ width: '100%', height: 180 }}>
                                <ResponsiveContainer>
                                    <PieChart>
                                        <Pie
                                            data={metrics.mixPagamento}
                                            dataKey="valor"
                                            nameKey="metodo"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={80}
                                            paddingAngle={2}
                                        >
                                            {metrics.mixPagamento.map((entry) => (
                                                <Cell key={entry.metodo} fill={PAYMENT_COLORS[entry.metodo] || '#9CA3AF'} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<MixTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-2 mt-2">
                                {metrics.mixPagamento.map((entry) => {
                                    const total = metrics.mixPagamento.reduce((s, m) => s + m.valor, 0);
                                    const pct = total > 0 ? (entry.valor / total) * 100 : 0;
                                    return (
                                        <div key={entry.metodo} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[entry.metodo] || '#9CA3AF' }} />
                                                <span className="text-gray-700 font-medium">{formatPaymentMethod(entry.metodo)}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-gray-800 font-bold">{pct.toFixed(0)}%</span>
                                                <span className="text-gray-500 ml-2">{formatCompact(entry.valor)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Rankings com filtro de período */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-2xl shadow-lg px-5 py-3 gap-3">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-semibold text-gray-700">Rankings</span>
                        {loadingRanking && (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-pink-600 ml-2"></div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Período:</span>
                        <select
                            value={rankingPeriod}
                            onChange={(e) => setRankingPeriod(e.target.value as RankingPeriod)}
                            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white cursor-pointer"
                        >
                            {(Object.keys(RANKING_LABELS) as RankingPeriod[]).map((key) => (
                                <option key={key} value={key}>{RANKING_LABELS[key].label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <TopClientsList
                        clientes={rankingOverride?.topClientes ?? metrics.topClientes}
                        periodTitle={RANKING_LABELS[rankingPeriod].title}
                    />
                    <TopProductsList
                        produtos={rankingOverride?.topProdutosLucro ?? metrics.topProdutosLucro}
                        periodTitle={RANKING_LABELS[rankingPeriod].title}
                    />
                </div>
            </div>

            {/* Heatmap */}
            <Heatmap data={metrics.heatmap} max={metrics.heatmapMax} />

            {/* Listas Secundárias */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Vendas Recentes</h3>
                        <ShoppingBag className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                        {metrics.vendasRecentes.length === 0 ? (
                            <p className="text-gray-500 text-center py-6 text-sm">Nenhuma venda registrada</p>
                        ) : (
                            metrics.vendasRecentes.map((venda) => {
                                const clienteNome = Array.isArray(venda.cliente) ? venda.cliente[0]?.nome : venda.cliente?.nome;
                                return (
                                    <div key={venda.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-800 text-sm truncate">{clienteNome || 'Cliente não identificado'}</p>
                                            <p className="text-xs text-gray-500 flex items-center mt-0.5">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <div className="text-right ml-2">
                                            <p className="font-bold text-green-600 text-sm">{formatCompact(Number(venda.valor_total))}</p>
                                            <p className="text-xs text-gray-500">{formatPaymentMethod(venda.forma_pagamento)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-800">Estoque Baixo</h3>
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="space-y-2">
                        {metrics.produtosBaixoEstoque.length === 0 ? (
                            <p className="text-gray-500 text-center py-6 text-sm">Estoque em dia ✅</p>
                        ) : (
                            metrics.produtosBaixoEstoque.map((produto) => (
                                <div key={produto.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100">
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-800 text-sm truncate">{produto.descricao}</p>
                                        <p className="text-xs text-gray-500">{produto.categoria}</p>
                                    </div>
                                    <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-bold ${produto.quantidade_estoque === 0
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-orange-100 text-orange-700'
                                        }`}>
                                        {produto.quantidade_estoque} un
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Clientes footer */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-6 text-white">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Users className="w-6 h-6 opacity-80" />
                            <span className="text-sm opacity-90">Total de Clientes</span>
                        </div>
                        <p className="text-4xl font-bold">{metrics.clientesTotal}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <TrendingUp className="w-6 h-6 opacity-80" />
                            <span className="text-sm opacity-90">Novos este mês</span>
                        </div>
                        <p className="text-4xl font-bold">+{metrics.novosMes}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Package className="w-6 h-6 opacity-80" />
                            <span className="text-sm opacity-90">Ativos (30d)</span>
                        </div>
                        <p className="text-4xl font-bold">{metrics.clientesAtivos}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============ SUB-COMPONENTS ============

interface KpiCardProps {
    title: string;
    value: string;
    delta?: number | null;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    subtitle?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, delta, icon: Icon, gradient, subtitle }) => {
    const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
    const isPositive = hasDelta && delta! >= 0;
    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br ${gradient} text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-white opacity-10"></div>
            <div className="relative">
                <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-xl bg-white bg-opacity-20 backdrop-blur-sm">
                        <Icon className="w-5 h-5" />
                    </div>
                    {hasDelta && (
                        <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${isPositive ? 'bg-white bg-opacity-25' : 'bg-black bg-opacity-20'}`}>
                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span className="ml-0.5">{Math.abs(delta!).toFixed(0)}%</span>
                        </div>
                    )}
                </div>
                <h3 className="text-xs font-medium text-white text-opacity-90 mb-1 uppercase tracking-wide">{title}</h3>
                <p className="text-2xl font-bold leading-tight">{value}</p>
                {subtitle && <p className="text-xs text-white text-opacity-80 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
};

const AlertPanel: React.FC<{ metrics: DashboardMetrics }> = ({ metrics }) => {
    const items: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string; to: string }[] = [];
    if (metrics.parcelasAtrasadas.quantidade > 0) {
        items.push({
            label: `${metrics.parcelasAtrasadas.quantidade} parcela(s) atrasada(s)`,
            value: formatCurrency(metrics.parcelasAtrasadas.total),
            icon: AlertCircle,
            color: 'text-red-700',
            bg: 'bg-red-50 hover:bg-red-100 border-red-200',
            to: '/crediario'
        });
    }
    if (metrics.parcelasSemana.quantidade > 0) {
        items.push({
            label: `${metrics.parcelasSemana.quantidade} parcela(s) vencem nesta semana`,
            value: formatCurrency(metrics.parcelasSemana.total),
            icon: Clock,
            color: 'text-yellow-700',
            bg: 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200',
            to: '/vencimentos'
        });
    }
    if (metrics.produtosSemEstoque > 0) {
        items.push({
            label: `${metrics.produtosSemEstoque} produto(s) sem estoque`,
            value: 'Zerados',
            icon: Package,
            color: 'text-orange-700',
            bg: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
            to: '/estoque'
        });
    }
    if (metrics.fornecedoresSemana.quantidade > 0) {
        items.push({
            label: `${metrics.fornecedoresSemana.quantidade} conta(s) a pagar esta semana`,
            value: formatCurrency(metrics.fornecedoresSemana.total),
            icon: Receipt,
            color: 'text-purple-700',
            bg: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
            to: '/financeiro'
        });
    }

    if (items.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl shadow-lg border-l-4 border-red-500 p-5">
            <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-bold text-gray-800">Atenção</h3>
                <span className="text-xs text-gray-500">você precisa olhar isso</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item, i) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={i}
                            to={item.to}
                            className={`flex items-center justify-between p-3 rounded-xl border ${item.bg} transition-colors`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <Icon className={`w-5 h-5 ${item.color} shrink-0`} />
                                <span className={`text-sm font-medium ${item.color} truncate`}>{item.label}</span>
                            </div>
                            <span className={`text-sm font-bold ${item.color} ml-2 shrink-0`}>{item.value}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

const TopClientsList: React.FC<{
    clientes: DashboardMetrics['topClientes'];
    periodTitle: string;
}> = ({ clientes, periodTitle }) => (
    <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Top Clientes {periodTitle}
            </h3>
        </div>
        {clientes.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-sm">Nenhuma venda este mês</p>
        ) : (
            <div className="space-y-3">
                {clientes.map((cliente, i) => (
                    <div key={cliente.id} className="flex items-center gap-3">
                        <div className="relative">
                            <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarGradient(cliente.nome)} flex items-center justify-center text-white font-bold text-sm shadow-md`}>
                                {getInitials(cliente.nome)}
                            </div>
                            {i === 0 && <span className="absolute -top-1 -right-1 text-lg">🥇</span>}
                            {i === 1 && <span className="absolute -top-1 -right-1 text-lg">🥈</span>}
                            {i === 2 && <span className="absolute -top-1 -right-1 text-lg">🥉</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{cliente.nome}</p>
                            <p className="text-xs text-gray-500">{cliente.compras} {cliente.compras === 1 ? 'compra' : 'compras'}</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-gray-900 text-sm">{formatCurrency(cliente.total)}</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const TopProductsList: React.FC<{
    produtos: DashboardMetrics['topProdutosLucro'];
    periodTitle: string;
}> = ({ produtos, periodTitle }) => (
    <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-500" />
                Top Produtos por Lucro
            </h3>
            <span className="text-xs text-gray-500">{periodTitle}</span>
        </div>
        {produtos.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-sm">Nenhum produto vendido este mês</p>
        ) : (
            <div className="space-y-3">
                {produtos.map((produto, i) => (
                    <div key={produto.id} className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                            {produto.image_url ? (
                                <img src={produto.image_url} alt={produto.descricao} loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                                <Package className="w-5 h-5 text-gray-400" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">
                                {i === 0 && '🥇 '}{produto.descricao}
                            </p>
                            <p className="text-xs text-gray-500">
                                {produto.categoria || 'Sem categoria'} • {produto.qtd} un
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-emerald-600 text-sm">{formatCompact(produto.lucro)}</p>
                            <p className="text-xs text-gray-500">{produto.margem.toFixed(0)}% margem</p>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const Heatmap: React.FC<{ data: number[][]; max: number }> = ({ data, max }) => {
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const slotLabel = (slot: number) => `${slot * 2}h`;

    const getCellColor = (value: number): string => {
        if (value === 0 || max === 0) return '#F3F4F6';
        const intensity = Math.min(1, value / max);
        // Rosa gradiente — de FCE7F3 a BE185D
        const alpha = 0.2 + intensity * 0.8;
        return `rgba(190, 24, 93, ${alpha.toFixed(2)})`;
    };

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">Padrão de Vendas por Horário</h3>
                <span className="text-xs text-gray-500">Últimos 90 dias</span>
            </div>
            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                    {/* Cabeçalho das horas */}
                    <div className="flex gap-1 ml-10 mb-1">
                        {Array.from({ length: 12 }).map((_, slot) => (
                            <div key={slot} className="w-8 text-[10px] text-gray-500 text-center font-medium">
                                {slotLabel(slot)}
                            </div>
                        ))}
                    </div>
                    {/* Linhas dos dias */}
                    {dias.map((dia, diaIdx) => (
                        <div key={dia} className="flex items-center gap-1 mb-1">
                            <div className="w-9 text-xs text-gray-600 font-semibold">{dia}</div>
                            {Array.from({ length: 12 }).map((_, slot) => {
                                const value = data[diaIdx][slot];
                                return (
                                    <div
                                        key={slot}
                                        className="w-8 h-8 rounded cursor-pointer transition-transform hover:scale-110"
                                        style={{ backgroundColor: getCellColor(value) }}
                                        title={value > 0 ? `${dia} ${slotLabel(slot)}–${slotLabel(slot + 1)}: ${formatCurrency(value)}` : `${dia} ${slotLabel(slot)}: sem vendas`}
                                    />
                                );
                            })}
                        </div>
                    ))}
                    {/* Legenda */}
                    <div className="flex items-center justify-end gap-2 mt-3 ml-10">
                        <span className="text-[10px] text-gray-500">Menos</span>
                        {[0.2, 0.4, 0.6, 0.8, 1.0].map((alpha) => (
                            <div
                                key={alpha}
                                className="w-4 h-4 rounded"
                                style={{ backgroundColor: `rgba(190, 24, 93, ${alpha})` }}
                            />
                        ))}
                        <span className="text-[10px] text-gray-500">Mais</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============ TOOLTIPS ============

const ReceitaLucroTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const receita = payload.find((p: any) => p.dataKey === 'receita')?.value || 0;
    const lucro = payload.find((p: any) => p.dataKey === 'lucro')?.value || 0;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    return (
        <div className="bg-white shadow-xl rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-bold text-gray-800 uppercase mb-2">{label}</p>
            <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-500" />
                    <span className="text-gray-600">Receita:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(receita)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-gray-600">Lucro:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(lucro)}</span>
                </div>
                <div className="pt-1 border-t border-gray-100">
                    <span className="text-gray-600">Margem: </span>
                    <span className="font-bold text-emerald-600">{margem.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
};

const MixTooltip: React.FC<any> = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const entry = payload[0].payload;
    return (
        <div className="bg-white shadow-xl rounded-lg p-3 border border-gray-100">
            <p className="text-xs font-bold text-gray-800">{formatPaymentMethod(entry.metodo)}</p>
            <p className="text-xs text-gray-600 mt-1">{formatCurrency(entry.valor)}</p>
            <p className="text-[10px] text-gray-500">{entry.quantidade} venda(s)</p>
        </div>
    );
};

export default Dashboard;
