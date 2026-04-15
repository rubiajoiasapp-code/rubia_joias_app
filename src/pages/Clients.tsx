import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, UserPlus, X, Edit3, Search } from 'lucide-react';
import { normalizeCpf, normalizePhone, isValidCpf, formatCpf, formatPhone } from '../lib/format';
import { cacheGet, cacheSet, cacheInvalidate } from '../lib/cache';
import type { ClientTier } from '../lib/clientTier';
import { TIER_INFO, fetchClientTierMap } from '../lib/clientTier';
import type { ClientStats, ScoreBreakdown } from '../lib/clientScore';
import { computeScore, fetchClientStatsMap, maxGastoFromStats, scoreBand } from '../lib/clientScore';
import { notify } from '../lib/notify';

interface Client {
    id: string;
    nome: string;
    cpf: string;
    endereco: string;
    telefone: string;
}

const emptyForm = { nome: '', cpf: '', endereco: '', telefone: '' };

const Clients: React.FC = () => {
    const initialCached = cacheGet<Client[]>('clients_list');
    const [clients, setClients] = useState<Client[]>(initialCached || []);
    const [tierMap, setTierMap] = useState<Record<string, ClientTier>>({});
    const [statsMap, setStatsMap] = useState<Record<string, ClientStats>>({});
    const [loading, setLoading] = useState(!initialCached);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const mountedRef = useRef(true);
    const formCardRef = useRef<HTMLDivElement>(null);
    const firstInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        mountedRef.current = true;
        fetchClients();
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchClients = async () => {
        try {
            const [clientsRes, tiers, stats] = await Promise.all([
                supabase
                    .from('clientes')
                    .select('*')
                    .order('created_at', { ascending: false }),
                fetchClientTierMap(),
                fetchClientStatsMap(),
            ]);

            if (clientsRes.error) throw clientsRes.error;
            if (!mountedRef.current) return;
            setClients(clientsRes.data || []);
            setTierMap(tiers);
            setStatsMap(stats);
            cacheSet('clients_list', clientsRes.data || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    const getTier = (clientId: string): ClientTier =>
        tierMap[clientId] || 'NOVO';

    const maxGasto = maxGastoFromStats(statsMap);
    const getStats = (clientId: string): ClientStats =>
        statsMap[clientId] || { totalGasto: 0, numVendas: 0, ultimaCompraISO: null };
    const getScore = (clientId: string): ScoreBreakdown =>
        computeScore(getStats(clientId), getTier(clientId), maxGasto);

    const sortedClients = [...clients].sort((a, b) => {
        const sa = getScore(a.id).total;
        const sb = getScore(b.id).total;
        if (sa !== sb) return sb - sa;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    });

    const needle = searchTerm.trim().toLowerCase();
    const needleDigits = needle.replace(/\D/g, '');
    const visibleClients = needle === '' ? sortedClients : sortedClients.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const endereco = (c.endereco || '').toLowerCase();
        const cpfDigits = (c.cpf || '').replace(/\D/g, '');
        const phoneDigits = (c.telefone || '').replace(/\D/g, '');
        return (
            nome.includes(needle) ||
            endereco.includes(needle) ||
            (needleDigits !== '' && (cpfDigits.includes(needleDigits) || phoneDigits.includes(needleDigits)))
        );
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData(emptyForm);
        setEditingId(null);
    };

    const handleEdit = (client: Client) => {
        setEditingId(client.id);
        setFormData({
            nome: client.nome || '',
            cpf: client.cpf || '',
            endereco: client.endereco || '',
            telefone: client.telefone || ''
        });
        // Rola até o form e dá foco no primeiro input
        requestAnimationFrame(() => {
            formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => firstInputRef.current?.focus(), 350);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingRef.current) return;

        // Validação
        const nome = formData.nome.trim();
        if (!nome) {
            notify.warning('Informe o nome do cliente.');
            return;
        }

        const cpfRaw = formData.cpf.trim();
        const cpfNormalizado = cpfRaw ? normalizeCpf(cpfRaw) : '';
        if (cpfNormalizado && !isValidCpf(cpfNormalizado)) {
            const continuar = await notify.confirm({
                title: 'CPF parece inválido',
                description: 'Os dígitos verificadores não batem. Deseja salvar mesmo assim?',
                confirmText: 'Salvar mesmo assim',
            });
            if (!continuar) return;
        }

        const telefoneNormalizado = formData.telefone ? normalizePhone(formData.telefone) : '';

        const payload = {
            nome,
            cpf: cpfNormalizado || null,
            endereco: formData.endereco.trim() || null,
            telefone: telefoneNormalizado || null
        };

        submittingRef.current = true;
        setSubmitting(true);

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('clientes')
                    .update(payload)
                    .eq('id', editingId);

                if (error) throw error;
                notify.success('Cliente atualizado com sucesso!');
            } else {
                const { error } = await supabase
                    .from('clientes')
                    .insert([payload])
                    .select();

                if (error) throw error;
                notify.success('Cliente cadastrado com sucesso!');
            }
            resetForm();
            cacheInvalidate('clients_list');
            fetchClients();
        } catch (error) {
            console.error('❌ Error saving client:', error);
            const err = error as { code?: string; message?: string };
            if (err.code === '23505') {
                notify.error('CPF já cadastrado', { description: 'Este CPF pertence a outro cliente.' });
            } else if (err.message?.includes('Failed to fetch')) {
                notify.error('Erro de conexão', { description: 'Verifique sua conexão e as credenciais.' });
            } else {
                notify.error(editingId ? 'Erro ao atualizar cliente' : 'Erro ao cadastrar cliente', {
                    description: err.message,
                });
            }
        } finally {
            submittingRef.current = false;
            if (mountedRef.current) setSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await notify.confirm({
            title: 'Excluir cliente?',
            description: 'Essa ação não pode ser desfeita.',
            confirmText: 'Excluir',
            tone: 'danger',
        });
        if (!ok) return;

        try {
            const { error } = await supabase
                .from('clientes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            notify.success('Cliente excluído com sucesso!');
            cacheInvalidate('clients_list');
            fetchClients();
        } catch (error) {
            console.error('Error deleting client:', error);
            const err = error as { code?: string; message?: string };
            if (err.code === '23503') {
                notify.error('Não é possível excluir', { description: 'Este cliente possui vendas registradas.' });
            } else {
                notify.error('Erro ao excluir cliente', { description: err?.message || 'erro desconhecido' });
            }
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Clientes</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div
                    ref={formCardRef}
                    className={`bg-white p-6 rounded-lg shadow-md h-fit transition-all ${editingId ? 'ring-4 ring-blue-500 animate-edit-glow shadow-blue-200' : ''}`}
                >
                    {editingId && (
                        <div className="mb-4 inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-sm font-bold animate-pulse">
                            <Edit3 className="w-4 h-4" />
                            Em edição
                        </div>
                    )}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">
                            {editingId ? 'Editar Cliente' : 'Novo Cliente'}
                        </h3>
                        {editingId && (
                            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700" title="Cancelar edição">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
                                ref={firstInputRef}
                                type="text"
                                name="nome"
                                placeholder="Nome Completo"
                                value={formData.nome}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                required
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                name="cpf"
                                placeholder="CPF (ex: 111.222.333-44)"
                                value={formData.cpf}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                name="endereco"
                                placeholder="Endereço"
                                value={formData.endereco}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                name="telefone"
                                placeholder="Telefone (ex: (11) 99999-9999)"
                                value={formData.telefone}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`w-full text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-pink-600 hover:bg-pink-700'}`}
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            {submitting ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar')}
                        </button>
                    </form>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                placeholder="Buscar por nome, CPF, telefone ou endereço..."
                                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                                    title="Limpar"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {needle
                                ? `${visibleClients.length} de ${sortedClients.length} clientes encontrados`
                                : `${sortedClients.length} clientes cadastrados`}
                        </p>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-600 mr-1">Score:</span>
                            {[90, 75, 60, 40, 20, 0].map(min => {
                                const band = scoreBand(min);
                                const label = `${min === 0 ? '0' : min}+`;
                                return (
                                    <span
                                        key={min}
                                        title={`${band.label}: ${min} pontos ou mais`}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${band.bgClass} ${band.textClass} ${band.borderClass}`}
                                    >
                                        <span>{band.emoji}</span>
                                        <span>{label} · {band.label}</span>
                                    </span>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-600 mr-1">Pagador:</span>
                            {(['EXCELENTE', 'BOM', 'NOVO', 'ATENCAO', 'CRITICO'] as ClientTier[]).map(t => {
                                const info = TIER_INFO[t];
                                return (
                                    <span
                                        key={t}
                                        title={info.description}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${info.bgClass} ${info.textClass} ${info.borderClass}`}
                                    >
                                        <span>{info.emoji}</span>
                                        <span>{info.short}</span>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-sm">
                                    <th className="p-4 font-medium text-center">Score</th>
                                    <th className="p-4 font-medium">Pagador</th>
                                    <th className="p-4 font-medium">Nome</th>
                                    <th className="p-4 font-medium">Contato</th>
                                    <th className="p-4 font-medium">CPF</th>
                                    <th className="p-4 font-medium">Endereço</th>
                                    <th className="p-4 font-medium text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center">Carregando...</td>
                                    </tr>
                                ) : sortedClients.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center">Nenhum cliente cadastrado.</td>
                                    </tr>
                                ) : visibleClients.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center text-gray-500">
                                            Nenhum cliente encontrado para "{searchTerm}".
                                        </td>
                                    </tr>
                                ) : (
                                    visibleClients.map((client) => {
                                        const tier = getTier(client.id);
                                        const info = TIER_INFO[tier];
                                        const stats = getStats(client.id);
                                        const breakdown = getScore(client.id);
                                        const band = scoreBand(breakdown.total);
                                        const lastPurchaseLabel = stats.ultimaCompraISO
                                            ? new Date(stats.ultimaCompraISO).toLocaleDateString('pt-BR')
                                            : '—';
                                        const tooltip =
                                            `Score: ${breakdown.total}/100 — ${band.label}\n` +
                                            `\n` +
                                            `💰 Monetário: ${breakdown.monetario}/30 (R$ ${stats.totalGasto.toFixed(2)} gastos)\n` +
                                            `🔁 Frequência: ${breakdown.frequencia}/25 (${stats.numVendas} venda${stats.numVendas === 1 ? '' : 's'})\n` +
                                            `📅 Recência: ${breakdown.recencia}/20 (última: ${lastPurchaseLabel})\n` +
                                            `💳 Pontualidade: ${breakdown.pontualidade}/25 (${info.short})`;
                                        return (
                                            <tr key={client.id} className={`border-t border-gray-100 hover:bg-gray-50 ${editingId === client.id ? 'bg-blue-50' : ''}`}>
                                                <td className="p-4 text-center" title={tooltip}>
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`inline-flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold border-2 ${band.bgClass} ${band.textClass} ${band.borderClass}`}>
                                                            {breakdown.total}
                                                        </span>
                                                        <span className={`text-[10px] font-medium ${band.textClass}`}>
                                                            {band.emoji} {band.label}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <span
                                                        title={info.description}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${info.bgClass} ${info.textClass} ${info.borderClass}`}
                                                    >
                                                        <span>{info.emoji}</span>
                                                        <span>{info.short}</span>
                                                    </span>
                                                </td>
                                                <td className="p-4 font-medium">{client.nome}</td>
                                                <td className="p-4">{formatPhone(client.telefone || '')}</td>
                                                <td className="p-4">{formatCpf(client.cpf || '')}</td>
                                                <td className="p-4">{client.endereco}</td>
                                                <td className="p-4 flex justify-center space-x-2">
                                                    <button
                                                        onClick={() => handleEdit(client)}
                                                        className="text-gray-400 hover:text-blue-500"
                                                        title="Editar"
                                                    >
                                                        <Pencil className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client.id)}
                                                        className="text-gray-400 hover:text-red-500"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Clients;
