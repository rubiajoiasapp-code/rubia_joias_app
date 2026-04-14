import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Search,
    Filter,
    X,
    ChevronDown,
    ChevronUp,
    DollarSign,
    ShoppingBag,
    TrendingUp,
    Package as PackageIcon,
    History as HistoryIcon,
    Calendar,
    User,
    Tag,
    CreditCard,
    CheckCircle2,
    AlertTriangle,
    Clock
} from 'lucide-react';
import { todayLocalISO } from '../lib/format';
import { cacheGet } from '../lib/cache';

// ============ TYPES ============

interface ClienteOption {
    id: string;
    nome: string;
}

interface ProdutoOption {
    id: string;
    descricao: string;
    categoria: string | null;
}

interface SaleItem {
    id: string;
    quantidade: number;
    valor_unitario: number;
    produto: {
        id: string;
        descricao: string;
        categoria: string | null;
        valor_custo: number | null;
        image_url: string | null;
    } | null;
}

interface Parcela {
    pago: boolean;
    data_vencimento: string;
}

interface Sale {
    id: string;
    data_venda: string;
    valor_total: number;
    forma_pagamento: string;
    cliente_id: string;
    cliente: { id: string; nome: string } | null;
    itens: SaleItem[];
    parcelas: Parcela[];
}

type StatusPagamento = 'QUITADA' | 'ATRASADA' | 'PENDENTE' | 'SEM_PARCELAS';

interface Filters {
    clienteId: string;
    produtoId: string;
    categoria: string;
    formaPagamento: string;
    status: StatusPagamento | '';
    mes: string; // '' | '1'..'12'
    ano: string; // '' | '2024'..
    dataInicio: string; // YYYY-MM-DD
    dataFim: string; // YYYY-MM-DD
}

const EMPTY_FILTERS: Filters = {
    clienteId: '',
    produtoId: '',
    categoria: '',
    formaPagamento: '',
    status: '',
    mes: '',
    ano: '',
    dataInicio: '',
    dataFim: ''
};

// ============ HELPERS ============

const formatCurrency = (v: number): string =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (isoDate: string): string => {
    const clean = isoDate.split('T')[0];
    const [y, m, d] = clean.split('-');
    return `${d}/${m}/${y}`;
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

const calculateSaleStatus = (parcelas: Parcela[], hoje: string): StatusPagamento => {
    if (!parcelas || parcelas.length === 0) return 'SEM_PARCELAS';
    const naoPagas = parcelas.filter(p => !p.pago);
    if (naoPagas.length === 0) return 'QUITADA';
    const temAtrasada = naoPagas.some(p => p.data_vencimento < hoje);
    return temAtrasada ? 'ATRASADA' : 'PENDENTE';
};

const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Meses em PT-BR
const MESES = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
];

// Gera lista de anos (últimos 5 + ano atual + próximo)
const ANOS = (() => {
    const atual = new Date().getFullYear();
    const anos: { value: string; label: string }[] = [];
    for (let y = atual + 1; y >= atual - 5; y--) {
        anos.push({ value: String(y), label: String(y) });
    }
    return anos;
})();

// ============ MAIN COMPONENT ============

const Historico: React.FC = () => {
    // Dados do dropdown
    const [clientes, setClientes] = useState<ClienteOption[]>([]);
    const [produtos, setProdutos] = useState<ProdutoOption[]>([]);

    // Estado dos filtros (draft) e filtros aplicados
    const [filtersDraft, setFiltersDraft] = useState<Filters>(() => {
        // Default: últimos 90 dias
        const now = new Date();
        const noventaDiasAtras = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90));
        return { ...EMPTY_FILTERS, dataInicio: noventaDiasAtras, dataFim: todayLocalISO() };
    });
    const [appliedFilters, setAppliedFilters] = useState<Filters>(filtersDraft);

    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        loadDropdownData();
        fetchSales(appliedFilters);
        return () => {
            mountedRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadDropdownData = async () => {
        // Tenta cache primeiro (chaves compartilhadas com Clientes/Inventory)
        const cachedClientes = cacheGet<ClienteOption[]>('clients_list');
        const cachedProdutos = cacheGet<ProdutoOption[]>('inventory_products');

        if (cachedClientes) setClientes(cachedClientes);
        if (cachedProdutos) setProdutos(cachedProdutos);

        // Busca fresh em paralelo se algum faltou
        const needClientes = !cachedClientes;
        const needProdutos = !cachedProdutos;

        if (!needClientes && !needProdutos) return;

        const tasks: Promise<any>[] = [];
        if (needClientes) {
            tasks.push(
                Promise.resolve(supabase.from('clientes').select('id, nome').order('nome'))
            );
        }
        if (needProdutos) {
            tasks.push(
                Promise.resolve(supabase.from('produtos').select('id, descricao, categoria').order('descricao'))
            );
        }

        const results = await Promise.all(tasks);
        let idx = 0;
        if (needClientes && mountedRef.current) {
            setClientes((results[idx].data || []) as ClienteOption[]);
            idx++;
        }
        if (needProdutos && mountedRef.current) {
            setProdutos((results[idx].data || []) as ProdutoOption[]);
        }
    };

    // Categorias derivadas dos produtos
    const categorias = useMemo(() => {
        const set = new Set<string>();
        produtos.forEach(p => {
            if (p.categoria) set.add(p.categoria);
        });
        return Array.from(set).sort();
    }, [produtos]);

    // Resolve o range de datas efetivo a partir dos filtros
    const resolveDateRange = (f: Filters): { inicio: string; fim: string } => {
        // Período customizado tem precedência se AMBOS estão preenchidos
        if (f.dataInicio && f.dataFim) {
            return { inicio: f.dataInicio, fim: f.dataFim };
        }
        // Só mes/ano
        if (f.mes && f.ano) {
            const y = parseInt(f.ano, 10);
            const m = parseInt(f.mes, 10) - 1; // JS 0-indexed
            return {
                inicio: formatLocalDate(new Date(y, m, 1)),
                fim: formatLocalDate(new Date(y, m + 1, 0))
            };
        }
        // Só ano
        if (f.ano && !f.mes) {
            const y = parseInt(f.ano, 10);
            return {
                inicio: formatLocalDate(new Date(y, 0, 1)),
                fim: formatLocalDate(new Date(y, 11, 31))
            };
        }
        // Só mes sem ano → usa ano atual
        if (f.mes && !f.ano) {
            const y = new Date().getFullYear();
            const m = parseInt(f.mes, 10) - 1;
            return {
                inicio: formatLocalDate(new Date(y, m, 1)),
                fim: formatLocalDate(new Date(y, m + 1, 0))
            };
        }
        // Default: últimos 90 dias
        const now = new Date();
        return {
            inicio: formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90)),
            fim: todayLocalISO()
        };
    };

    const fetchSales = async (f: Filters) => {
        setLoading(true);
        try {
            const { inicio, fim } = resolveDateRange(f);

            let query = supabase
                .from('vendas')
                .select(`
                    id,
                    data_venda,
                    valor_total,
                    forma_pagamento,
                    cliente_id,
                    cliente:clientes(id, nome),
                    itens:itens_venda(
                        id,
                        quantidade,
                        valor_unitario,
                        produto:produtos(id, descricao, categoria, valor_custo, image_url)
                    ),
                    parcelas:parcelas_venda(pago, data_vencimento)
                `)
                .gte('data_venda', inicio)
                .lte('data_venda', fim + 'T23:59:59')
                .order('data_venda', { ascending: false });

            if (f.clienteId) query = query.eq('cliente_id', f.clienteId);
            if (f.formaPagamento) query = query.eq('forma_pagamento', f.formaPagamento);

            const { data, error } = await query;
            if (error) throw error;

            const normalized: Sale[] = ((data || []) as any[]).map((raw) => ({
                id: raw.id,
                data_venda: raw.data_venda,
                valor_total: Number(raw.valor_total) || 0,
                forma_pagamento: raw.forma_pagamento,
                cliente_id: raw.cliente_id,
                cliente: Array.isArray(raw.cliente) ? raw.cliente[0] || null : raw.cliente,
                itens: (raw.itens || []).map((item: any) => ({
                    id: item.id,
                    quantidade: Number(item.quantidade) || 0,
                    valor_unitario: Number(item.valor_unitario) || 0,
                    produto: Array.isArray(item.produto) ? item.produto[0] || null : item.produto
                })),
                parcelas: (raw.parcelas || []).map((p: any) => ({
                    pago: !!p.pago,
                    data_vencimento: p.data_vencimento
                }))
            }));

            // Filtros client-side
            const hoje = todayLocalISO();
            const filtered = normalized.filter((sale) => {
                // Produto específico
                if (f.produtoId && !sale.itens.some(it => it.produto?.id === f.produtoId)) return false;
                // Categoria
                if (f.categoria && !sale.itens.some(it => it.produto?.categoria === f.categoria)) return false;
                // Status
                if (f.status) {
                    const status = calculateSaleStatus(sale.parcelas, hoje);
                    if (status !== f.status) return false;
                }
                return true;
            });

            if (!mountedRef.current) return;
            setSales(filtered);
        } catch (err: any) {
            console.error('Error fetching sales:', err);
            alert('Erro ao buscar histórico: ' + (err?.message || 'tente novamente'));
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    const handleApply = () => {
        setAppliedFilters(filtersDraft);
        fetchSales(filtersDraft);
    };

    const handleClear = () => {
        const now = new Date();
        const noventaDiasAtras = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90));
        const cleared: Filters = { ...EMPTY_FILTERS, dataInicio: noventaDiasAtras, dataFim: todayLocalISO() };
        setFiltersDraft(cleared);
        setAppliedFilters(cleared);
        fetchSales(cleared);
    };

    // Resumo agregado
    const summary = useMemo(() => {
        const totalVendido = sales.reduce((s, v) => s + v.valor_total, 0);
        const qtdVendas = sales.length;
        const ticketMedio = qtdVendas > 0 ? totalVendido / qtdVendas : 0;
        const lucroTotal = sales.reduce((s, v) => {
            return s + v.itens.reduce((is, it) => {
                const custo = it.produto?.valor_custo || 0;
                return is + (it.valor_unitario - custo) * it.quantidade;
            }, 0);
        }, 0);
        return { totalVendido, qtdVendas, ticketMedio, lucroTotal };
    }, [sales]);

    const filtersSignature = useMemo(() => JSON.stringify(filtersDraft), [filtersDraft]);
    const appliedSignature = useMemo(() => JSON.stringify(appliedFilters), [appliedFilters]);
    const hasUnappliedChanges = filtersSignature !== appliedSignature;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <HistoryIcon className="w-8 h-8 text-pink-600" />
                    Histórico de Vendas
                </h1>
                <p className="text-gray-600 mt-1 text-sm">
                    Filtre, explore e analise todas as suas vendas
                </p>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Filter className="w-5 h-5 text-pink-600" />
                        Filtros
                    </h3>
                    <button
                        onClick={handleClear}
                        className="text-sm text-gray-600 hover:text-red-600 flex items-center gap-1 transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Limpar todos
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Cliente */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <User className="w-3 h-3" /> Cliente
                        </label>
                        <select
                            value={filtersDraft.clienteId}
                            onChange={(e) => setFiltersDraft({ ...filtersDraft, clienteId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Todos os clientes</option>
                            {clientes.map((c) => (
                                <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                        </select>
                    </div>

                    {/* Produto */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <PackageIcon className="w-3 h-3" /> Produto
                        </label>
                        <select
                            value={filtersDraft.produtoId}
                            onChange={(e) => setFiltersDraft({ ...filtersDraft, produtoId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Todos os produtos</option>
                            {produtos.map((p) => (
                                <option key={p.id} value={p.id}>{p.descricao}</option>
                            ))}
                        </select>
                    </div>

                    {/* Categoria */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Categoria
                        </label>
                        <select
                            value={filtersDraft.categoria}
                            onChange={(e) => setFiltersDraft({ ...filtersDraft, categoria: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Todas as categorias</option>
                            {categorias.map((cat) => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Forma de Pagamento */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> Forma de Pagamento
                        </label>
                        <select
                            value={filtersDraft.formaPagamento}
                            onChange={(e) => setFiltersDraft({ ...filtersDraft, formaPagamento: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Todas as formas</option>
                            <option value="PIX">PIX</option>
                            <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                            <option value="CARTAO_DEBITO">Cartão de Débito</option>
                            <option value="DINHEIRO">Dinheiro</option>
                            <option value="FIADO">Fiado</option>
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Status
                        </label>
                        <select
                            value={filtersDraft.status}
                            onChange={(e) => setFiltersDraft({ ...filtersDraft, status: e.target.value as Filters['status'] })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Todos os status</option>
                            <option value="QUITADA">Quitadas</option>
                            <option value="PENDENTE">Com parcelas pendentes</option>
                            <option value="ATRASADA">Com parcelas atrasadas</option>
                            <option value="SEM_PARCELAS">Sem parcelas cadastradas</option>
                        </select>
                    </div>

                    {/* Mês */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Mês
                        </label>
                        <select
                            value={filtersDraft.mes}
                            onChange={(e) => setFiltersDraft({ ...filtersDraft, mes: e.target.value, dataInicio: '', dataFim: '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Qualquer mês</option>
                            {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>

                    {/* Ano */}
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Ano
                        </label>
                        <select
                            value={filtersDraft.ano}
                            onChange={(e) => setFiltersDraft({ ...filtersDraft, ano: e.target.value, dataInicio: '', dataFim: '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Qualquer ano</option>
                            {ANOS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                    </div>
                </div>

                {/* Período Customizado */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Período Customizado <span className="font-normal text-gray-500 lowercase">(sobrepõe mês/ano se preenchido)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">De</label>
                            <input
                                type="date"
                                value={filtersDraft.dataInicio}
                                onChange={(e) => setFiltersDraft({ ...filtersDraft, dataInicio: e.target.value, mes: '', ano: '' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Até</label>
                            <input
                                type="date"
                                value={filtersDraft.dataFim}
                                onChange={(e) => setFiltersDraft({ ...filtersDraft, dataFim: e.target.value, mes: '', ano: '' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Botão Aplicar */}
                <div className="mt-5 flex items-center justify-end gap-3">
                    {hasUnappliedChanges && (
                        <span className="text-xs text-amber-600 font-medium">
                            • Filtros alterados, clique em Aplicar
                        </span>
                    )}
                    <button
                        onClick={handleApply}
                        disabled={loading}
                        className="bg-pink-600 text-white font-bold px-6 py-2 rounded-lg hover:bg-pink-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Search className="w-4 h-4" />
                        {loading ? 'Buscando...' : 'Aplicar Filtros'}
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    icon={DollarSign}
                    label="Total Vendido"
                    value={formatCurrency(summary.totalVendido)}
                    gradient="from-pink-500 to-rose-600"
                />
                <SummaryCard
                    icon={ShoppingBag}
                    label="Nº de Vendas"
                    value={String(summary.qtdVendas)}
                    gradient="from-blue-500 to-cyan-600"
                />
                <SummaryCard
                    icon={TrendingUp}
                    label="Ticket Médio"
                    value={formatCurrency(summary.ticketMedio)}
                    gradient="from-violet-500 to-purple-600"
                />
                <SummaryCard
                    icon={TrendingUp}
                    label="Lucro Bruto"
                    value={formatCurrency(summary.lucroTotal)}
                    gradient="from-emerald-500 to-teal-600"
                />
            </div>

            {/* Lista de Vendas */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">
                        {loading ? 'Buscando...' : `${sales.length} ${sales.length === 1 ? 'venda encontrada' : 'vendas encontradas'}`}
                    </h3>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600"></div>
                    </div>
                ) : sales.length === 0 ? (
                    <div className="text-center py-16">
                        <HistoryIcon className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">Nenhuma venda encontrada com esses filtros</p>
                        <p className="text-xs text-gray-400 mt-1">Tente ajustar os filtros ou limpar tudo</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sales.map((sale) => (
                            <SaleRow
                                key={sale.id}
                                sale={sale}
                                expanded={expandedSale === sale.id}
                                onToggle={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ============ SUB-COMPONENTS ============

const SummaryCard: React.FC<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    gradient: string;
}> = ({ icon: Icon, label, value, gradient }) => (
    <div className={`bg-gradient-to-br ${gradient} rounded-2xl shadow-lg p-4 text-white`}>
        <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white bg-opacity-20 rounded-lg backdrop-blur-sm">
                <Icon className="w-4 h-4" />
            </div>
        </div>
        <p className="text-xs text-white text-opacity-90 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold mt-1 leading-tight">{value}</p>
    </div>
);

const StatusBadge: React.FC<{ status: StatusPagamento }> = ({ status }) => {
    const config: Record<StatusPagamento, { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
        QUITADA: { label: 'Quitada', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
        ATRASADA: { label: 'Atrasada', bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
        PENDENTE: { label: 'Pendente', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock },
        SEM_PARCELAS: { label: 'À vista', bg: 'bg-gray-100', text: 'text-gray-700', icon: CheckCircle2 }
    };
    const { label, bg, text, icon: Icon } = config[status];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${bg} ${text}`}>
            <Icon className="w-3 h-3" />
            {label}
        </span>
    );
};

const SaleRow: React.FC<{ sale: Sale; expanded: boolean; onToggle: () => void }> = ({ sale, expanded, onToggle }) => {
    const status = calculateSaleStatus(sale.parcelas, todayLocalISO());
    const clienteNome = sale.cliente?.nome || 'Cliente não identificado';
    const nItens = sale.itens.length;
    const nParcelasPendentes = sale.parcelas.filter(p => !p.pago).length;

    return (
        <div className={`border rounded-xl transition-colors ${expanded ? 'border-pink-300 bg-pink-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 text-left"
            >
                <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-3 items-center">
                    <div className="md:col-span-2">
                        <p className="font-semibold text-gray-800 truncate">{clienteNome}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3" />
                            {formatDate(sale.data_venda)}
                        </p>
                    </div>
                    <div className="text-xs">
                        <span className="text-gray-500">Pagamento</span>
                        <p className="font-medium text-gray-800">{formatPaymentMethod(sale.forma_pagamento)}</p>
                    </div>
                    <div className="text-xs">
                        <span className="text-gray-500">Status</span>
                        <div className="mt-0.5">
                            <StatusBadge status={status} />
                            {nParcelasPendentes > 0 && (
                                <p className="text-[10px] text-gray-500 mt-0.5">{nParcelasPendentes} parcela(s) pendente(s)</p>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg text-pink-600">{formatCurrency(sale.valor_total)}</p>
                        <p className="text-[10px] text-gray-500">{nItens} {nItens === 1 ? 'item' : 'itens'}</p>
                    </div>
                </div>
                <div className="ml-3 shrink-0">
                    {expanded
                        ? <ChevronUp className="w-5 h-5 text-gray-400" />
                        : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-pink-200 p-4 bg-white">
                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Produtos desta venda</div>
                    {sale.itens.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Nenhum item registrado</p>
                    ) : (
                        <div className="space-y-2">
                            {sale.itens.map((item) => {
                                const subtotal = item.quantidade * item.valor_unitario;
                                const custo = item.produto?.valor_custo || 0;
                                const lucroItem = (item.valor_unitario - custo) * item.quantidade;
                                return (
                                    <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                            {item.produto?.image_url ? (
                                                <img
                                                    src={item.produto.image_url}
                                                    alt={item.produto.descricao}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <PackageIcon className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {item.produto?.descricao || 'Produto removido'}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.produto?.categoria || 'Sem categoria'} • {item.quantidade}× {formatCurrency(item.valor_unitario)}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-gray-800">{formatCurrency(subtotal)}</p>
                                            {custo > 0 && (
                                                <p className="text-[10px] text-emerald-600">lucro {formatCurrency(lucroItem)}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Historico;
