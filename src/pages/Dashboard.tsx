import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    TrendingUp,
    DollarSign,
    ShoppingBag,
    Package,
    Users,
    AlertCircle,
    Calendar,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Box
} from 'lucide-react';
import { todayLocalISO } from '../lib/format';
import { cacheGet, cacheSet } from '../lib/cache';

interface DashboardMetrics {
    vendasHoje: number;
    vendasMes: number;
    contasPagar: number;
    produtosEstoque: number;
    clientesTotal: number;
    novosMes: number;
    clientesAtivos: number;
    vendasRecentes: any[];
    produtosBaixoEstoque: any[];
    receitaMensal: { mes: string; valor: number }[];
    produtoMaisVendido: {
        descricao: string;
        categoria: string;
        quantidade_vendida: number;
        receita_total: number;
    } | null;
}

const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const emptyMetrics: DashboardMetrics = {
    vendasHoje: 0,
    vendasMes: 0,
    contasPagar: 0,
    produtosEstoque: 0,
    clientesTotal: 0,
    novosMes: 0,
    clientesAtivos: 0,
    vendasRecentes: [],
    produtosBaixoEstoque: [],
    receitaMensal: [],
    produtoMaisVendido: null
};

const Dashboard: React.FC = () => {
    const initialCached = cacheGet<DashboardMetrics>('dashboard_metrics');
    const [metrics, setMetrics] = useState<DashboardMetrics>(initialCached || emptyMetrics);
    const [loading, setLoading] = useState(!initialCached);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        fetchDashboardData();
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchDashboardData = async () => {
        try {
            const hoje = todayLocalISO();
            const now = new Date();
            const primeiroDiaMes = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
            const trintaDiasAtras = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
            // Janela de 6 meses para gráfico de receita mensal
            const seisMesesAtrasDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            const seisMesesAtras = formatLocalDate(seisMesesAtrasDate);

            // Todas as queries em paralelo (reduz ~12 requests sequenciais para 1 round-trip).
            const [
                vendasJanelaRes,
                parcelasPendentesRes,
                produtosCountRes,
                clientesCountRes,
                novosMesCountRes,
                vendasRecentesDistRes,
                vendasRecentesRes,
                produtosBaixoEstoqueRes,
                itensVendaRes
            ] = await Promise.all([
                supabase
                    .from('vendas')
                    .select('valor_total, data_venda')
                    .gte('data_venda', seisMesesAtras),
                supabase
                    .from('parcelas_pagar')
                    .select('valor_parcela')
                    .eq('pago', false),
                supabase
                    .from('produtos')
                    .select('*', { count: 'estimated', head: true }),
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
                    .gte('data_venda', trintaDiasAtras),
                supabase
                    .from('vendas')
                    .select(`*, cliente:clientes(nome)`)
                    .order('data_venda', { ascending: false })
                    .limit(5),
                supabase
                    .from('produtos')
                    .select('*')
                    .lte('quantidade_estoque', 3)
                    .order('quantidade_estoque', { ascending: true })
                    .limit(5),
                supabase
                    .from('itens_venda')
                    .select(`
                        produto_id,
                        quantidade,
                        valor_unitario,
                        produto:produtos(descricao, categoria)
                    `)
                    .limit(5000)
            ]);

            // Deriva totalHoje, totalMes e receitaMensal a partir do mesmo dataset
            // de vendas da janela de 6 meses — 1 query em vez de 8.
            const vendasJanela = vendasJanelaRes.data || [];
            let totalHoje = 0;
            let totalMes = 0;
            const receitaMap = new Map<string, number>();
            for (const v of vendasJanela) {
                const dataStr = String(v.data_venda).slice(0, 10); // YYYY-MM-DD
                const valor = Number(v.valor_total) || 0;
                if (dataStr >= hoje) totalHoje += valor;
                if (dataStr >= primeiroDiaMes) totalMes += valor;
                const chaveMes = dataStr.slice(0, 7); // YYYY-MM
                receitaMap.set(chaveMes, (receitaMap.get(chaveMes) || 0) + valor);
            }

            const receitaMensal: { mes: string; valor: number }[] = [];
            for (let i = 5; i >= 0; i--) {
                const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const chave = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
                receitaMensal.push({
                    mes: ref.toLocaleDateString('pt-BR', { month: 'short' }),
                    valor: receitaMap.get(chave) || 0
                });
            }

            const parcelasPendentes = parcelasPendentesRes.data || [];
            const totalPagar = parcelasPendentes.reduce((sum, p) => sum + Number(p.valor_parcela), 0);
            const produtosCount = produtosCountRes.count || 0;
            const clientesCount = clientesCountRes.count || 0;
            const novosMesCount = novosMesCountRes.count || 0;

            const clientesAtivosSet = new Set<string>();
            (vendasRecentesDistRes.data || []).forEach((v: { cliente_id: string | null }) => {
                if (v.cliente_id) clientesAtivosSet.add(v.cliente_id);
            });
            const clientesAtivosCount = clientesAtivosSet.size;

            const vendasRecentes = vendasRecentesRes.data || [];
            const produtosBaixoEstoque = produtosBaixoEstoqueRes.data || [];
            const itensVenda = itensVendaRes.data || [];

            let produtoMaisVendido: DashboardMetrics['produtoMaisVendido'] = null;
            if (itensVenda.length > 0) {
                const produtosAgrupados: Record<string, {
                    descricao: string;
                    categoria: string;
                    quantidade_vendida: number;
                    receita_total: number;
                }> = {};
                itensVenda.forEach((item: any) => {
                    if (!item.produto_id) return;

                    if (!produtosAgrupados[item.produto_id]) {
                        produtosAgrupados[item.produto_id] = {
                            descricao: (Array.isArray(item.produto) ? item.produto[0]?.descricao : item.produto?.descricao) || 'Produto Desconhecido',
                            categoria: (Array.isArray(item.produto) ? item.produto[0]?.categoria : item.produto?.categoria) || '',
                            quantidade_vendida: 0,
                            receita_total: 0
                        };
                    }

                    produtosAgrupados[item.produto_id].quantidade_vendida += item.quantidade;
                    produtosAgrupados[item.produto_id].receita_total += item.quantidade * Number(item.valor_unitario);
                });

                const sorted = Object.values(produtosAgrupados).sort(
                    (a, b) => b.quantidade_vendida - a.quantidade_vendida
                );
                produtoMaisVendido = sorted[0] || null;
            }

            if (!mountedRef.current) return;
            const next: DashboardMetrics = {
                vendasHoje: totalHoje,
                vendasMes: totalMes,
                contasPagar: totalPagar,
                produtosEstoque: produtosCount,
                clientesTotal: clientesCount,
                novosMes: novosMesCount,
                clientesAtivos: clientesAtivosCount,
                vendasRecentes,
                produtosBaixoEstoque,
                receitaMensal,
                produtoMaisVendido
            };
            setMetrics(next);
            cacheSet('dashboard_metrics', next);
        } catch (error: any) {
            console.error('Error fetching dashboard data:', error);
            if (mountedRef.current) setErrorMsg('Não foi possível carregar os dados. ' + (error?.message || ''));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    const StatCard = ({ title, value, icon: Icon, trend, trendValue, gradient, prefix = '' }: any) => (
        <div className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${gradient} text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}>
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white opacity-10"></div>
            <div className="relative">
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-white bg-opacity-20 backdrop-blur-sm`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <div className={`flex items-center text-sm font-medium ${trend === 'up' ? 'text-green-200' : 'text-red-200'}`}>
                            {trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            <span className="ml-1">{trendValue}</span>
                        </div>
                    )}
                </div>
                <h3 className="text-sm font-medium text-white text-opacity-90 mb-2">{title}</h3>
                <p className="text-3xl font-bold">
                    {prefix}{typeof value === 'number' && prefix === 'R$ ' ? value.toFixed(2) : value}
                </p>
            </div>
        </div>
    );

    const maxReceita = Math.max(...metrics.receitaMensal.map(m => m.valor), 1);

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
                <p className="text-gray-600 mt-1 flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Vendas Hoje"
                    value={metrics.vendasHoje}
                    icon={DollarSign}
                    gradient="from-pink-500 to-rose-500"
                    prefix="R$ "
                    trend="up"
                    trendValue="+12%"
                />
                <StatCard
                    title="Vendas do Mês"
                    value={metrics.vendasMes}
                    icon={TrendingUp}
                    gradient="from-blue-500 to-cyan-500"
                    prefix="R$ "
                />
                <StatCard
                    title="Contas a Pagar"
                    value={metrics.contasPagar}
                    icon={AlertCircle}
                    gradient="from-orange-500 to-amber-500"
                    prefix="R$ "
                    trend="down"
                    trendValue="-5%"
                />
                <StatCard
                    title="Produtos Cadastrados"
                    value={metrics.produtosEstoque}
                    icon={Package}
                    gradient="from-purple-500 to-indigo-500"
                />
            </div>

            {/* Produto em Alta 🔥 */}
            {metrics.produtoMaisVendido && (
                <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-2xl shadow-xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <div className="text-4xl mr-3">🔥</div>
                            <div>
                                <h3 className="text-sm font-medium text-white text-opacity-90">Produto em Alta</h3>
                                <p className="text-xs text-white text-opacity-75">Mais vendido no período</p>
                            </div>
                        </div>
                        <TrendingUp className="w-8 h-8 text-white opacity-50" />
                    </div>

                    <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4 mt-4">
                        <h4 className="text-xl font-bold mb-1">{metrics.produtoMaisVendido.descricao}</h4>
                        <p className="text-sm text-white text-opacity-75 mb-4">{metrics.produtoMaisVendido.categoria}</p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white bg-opacity-10 rounded-lg p-3">
                                <p className="text-xs text-white text-opacity-75 mb-1">Quantidade Vendida</p>
                                <p className="text-2xl font-bold">{metrics.produtoMaisVendido.quantidade_vendida}</p>
                            </div>
                            <div className="bg-white bg-opacity-10 rounded-lg p-3">
                                <p className="text-xs text-white text-opacity-75 mb-1">Receita Gerada</p>
                                <p className="text-2xl font-bold">R$ {metrics.produtoMaisVendido.receita_total.toFixed(0)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Gráfico de Receita Mensal + Clientes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Receita Mensal */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800">Receita Mensal</h3>
                        <div className="flex items-center text-sm text-green-600 font-medium">
                            <TrendingUp className="w-4 h-4 mr-1" />
                            <span>Últimos 6 meses</span>
                        </div>
                    </div>
                    <div className="flex items-end justify-between h-64 space-x-3">
                        {metrics.receitaMensal.map((data, index) => {
                            const height = (data.valor / maxReceita) * 100;
                            return (
                                <div key={index} className="flex-1 flex flex-col items-center">
                                    <div className="w-full flex flex-col items-center mb-2">
                                        <span className="text-xs font-medium text-gray-700 mb-1">
                                            R$ {data.valor.toFixed(0)}
                                        </span>
                                        <div
                                            className="w-full bg-gradient-to-t from-pink-500 to-pink-300 rounded-t-lg hover:from-pink-600 hover:to-pink-400 transition-all duration-300 cursor-pointer"
                                            style={{ height: `${height}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-gray-600 font-medium uppercase">{data.mes}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Card de Clientes */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl shadow-lg p-6 text-white">
                    <div className="mb-6">
                        <div className="p-3 rounded-xl bg-white bg-opacity-20 backdrop-blur-sm w-fit mb-4">
                            <Users className="w-8 h-8" />
                        </div>
                        <h3 className="text-sm font-medium text-white text-opacity-90 mb-2">Total de Clientes</h3>
                        <p className="text-4xl font-bold">{metrics.clientesTotal}</p>
                    </div>
                    <div className="space-y-3 mt-8">
                        <div className="flex items-center justify-between text-sm bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-3">
                            <span>Novos este mês</span>
                            <span className="font-bold">+{metrics.novosMes}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-3">
                            <span>Ativos (últimos 30 dias)</span>
                            <span className="font-bold">{metrics.clientesAtivos}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Vendas Recentes + Produtos com Estoque Baixo */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendas Recentes */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800">Vendas Recentes</h3>
                        <ShoppingBag className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="space-y-3">
                        {metrics.vendasRecentes.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">Nenhuma venda registrada</p>
                        ) : (
                            metrics.vendasRecentes.map((venda) => (
                                <div key={venda.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                    <div>
                                        <p className="font-medium text-gray-800">{venda.cliente?.nome || 'Cliente não identificado'}</p>
                                        <p className="text-sm text-gray-500 flex items-center mt-1">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {new Date(venda.data_venda).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-600">R$ {Number(venda.valor_total).toFixed(2)}</p>
                                        <p className="text-xs text-gray-500 mt-1">{venda.forma_pagamento}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Produtos com Estoque Baixo */}
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800">Estoque Baixo</h3>
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                    </div>
                    <div className="space-y-3">
                        {metrics.produtosBaixoEstoque.length === 0 ? (
                            <div className="text-center py-8">
                                <Box className="w-12 h-12 text-green-500 mx-auto mb-2" />
                                <p className="text-gray-500">Todos os produtos com estoque OK!</p>
                            </div>
                        ) : (
                            metrics.produtosBaixoEstoque.map((produto) => (
                                <div key={produto.id} className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-800">{produto.descricao}</p>
                                        <p className="text-sm text-gray-500 mt-1">{produto.categoria}</p>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${produto.quantidade_estoque === 0
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {produto.quantidade_estoque} unid.
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
