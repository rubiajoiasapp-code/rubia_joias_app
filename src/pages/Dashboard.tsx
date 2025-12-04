import React, { useEffect, useState } from 'react';
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

interface DashboardMetrics {
    vendasHoje: number;
    vendasMes: number;
    contasPagar: number;
    produtosEstoque: number;
    clientesTotal: number;
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

const Dashboard: React.FC = () => {
    const [metrics, setMetrics] = useState<DashboardMetrics>({
        vendasHoje: 0,
        vendasMes: 0,
        contasPagar: 0,
        produtosEstoque: 0,
        clientesTotal: 0,
        vendasRecentes: [],
        produtosBaixoEstoque: [],
        receitaMensal: [],
        produtoMaisVendido: null
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const hoje = new Date().toISOString().split('T')[0];
            const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

            // Vendas de hoje
            const { data: vendasHoje } = await supabase
                .from('vendas')
                .select('valor_total')
                .gte('data_venda', hoje);

            const totalHoje = vendasHoje?.reduce((sum, v) => sum + Number(v.valor_total), 0) || 0;

            // Vendas do mês
            const { data: vendasMes } = await supabase
                .from('vendas')
                .select('valor_total')
                .gte('data_venda', primeiroDiaMes);

            const totalMes = vendasMes?.reduce((sum, v) => sum + Number(v.valor_total), 0) || 0;

            // Contas a pagar pendentes
            const { data: parcelasPendentes } = await supabase
                .from('parcelas_pagar')
                .select('valor_parcela')
                .eq('pago', false);

            const totalPagar = parcelasPendentes?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

            // Produtos em estoque
            const { count: produtosCount } = await supabase
                .from('produtos')
                .select('*', { count: 'exact', head: true });

            // Clientes totais
            const { count: clientesCount } = await supabase
                .from('clientes')
                .select('*', { count: 'exact', head: true });

            // Vendas recentes (últimas 5)
            const { data: vendasRecentes } = await supabase
                .from('vendas')
                .select(`
                    *,
                    cliente:clientes(nome)
                `)
                .order('data_venda', { ascending: false })
                .limit(5);

            // Produtos com estoque baixo (<=3 unidades)
            const { data: produtosBaixoEstoque } = await supabase
                .from('produtos')
                .select('*')
                .lte('quantidade_estoque', 3)
                .order('quantidade_estoque', { ascending: true })
                .limit(5);

            // Receita mensal (últimos 6 meses)
            const receitaMensal = [];
            for (let i = 5; i >= 0; i--) {
                const data = new Date();
                data.setMonth(data.getMonth() - i);
                const mesInicio = new Date(data.getFullYear(), data.getMonth(), 1).toISOString().split('T')[0];
                const mesFim = new Date(data.getFullYear(), data.getMonth() + 1, 0).toISOString().split('T')[0];

                const { data: vendas } = await supabase
                    .from('vendas')
                    .select('valor_total')
                    .gte('data_venda', mesInicio)
                    .lte('data_venda', mesFim);

                const total = vendas?.reduce((sum, v) => sum + Number(v.valor_total), 0) || 0;
                receitaMensal.push({
                    mes: data.toLocaleDateString('pt-BR', { month: 'short' }),
                    valor: total
                });
            }

            // Produto mais vendido (todos os tempos)
            const { data: itensVenda } = await supabase
                .from('itens_venda')
                .select(`
                    produto_id,
                    quantidade,
                    valor_unitario,
                    produto:produtos(descricao, categoria)
                `);

            let produtoMaisVendido = null;
            if (itensVenda && itensVenda.length > 0) {
                // Agrupar por produto_id
                const produtosAgrupados: any = {};
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

                // Encontrar o mais vendido
                const maisVendido = Object.values(produtosAgrupados).sort((a: any, b: any) =>
                    b.quantidade_vendida - a.quantidade_vendida
                )[0];

                produtoMaisVendido = maisVendido || null;
            }

            setMetrics({
                vendasHoje: totalHoje,
                vendasMes: totalMes,
                contasPagar: totalPagar,
                produtosEstoque: produtosCount || 0,
                clientesTotal: clientesCount || 0,
                vendasRecentes: vendasRecentes || [],
                produtosBaixoEstoque: produtosBaixoEstoque || [],
                receitaMensal,
                produtoMaisVendido: produtoMaisVendido as any
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
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
                            <span className="font-bold">+8</span>
                        </div>
                        <div className="flex items-center justify-between text-sm bg-white bg-opacity-10 backdrop-blur-sm rounded-lg p-3">
                            <span>Ativos</span>
                            <span className="font-bold">{Math.floor(metrics.clientesTotal * 0.7)}</span>
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
