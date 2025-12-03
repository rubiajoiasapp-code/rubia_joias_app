import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, DollarSign, User, Check, X, Edit2, ChevronDown, ChevronUp, AlertCircle, Trash2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import SaleReceipt from '../components/SaleReceipt';

interface Sale {
    id: string;
    cliente_id: string;
    data_venda: string;
    valor_total: number;
    forma_pagamento: string;
    cliente: {
        nome: string;
    };
}

interface Installment {
    id: string;
    venda_id: string;
    numero_parcela: number;
    valor_parcela: number;
    data_vencimento: string;
    data_pagamento: string | null;
    pago: boolean;
    observacoes: string | null;
}

interface SaleWithInstallments extends Sale {
    parcelas: Installment[];
    totalPago: number;
    totalPendente: number;
}

const Credit: React.FC = () => {
    const [sales, setSales] = useState<SaleWithInstallments[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSale, setExpandedSale] = useState<string | null>(null);
    const [editingInstallment, setEditingInstallment] = useState<Installment | null>(null);
    const [filter, setFilter] = useState<'TODAS' | 'PARCELADAS' | 'AVISTA'>('TODAS');
    const [editForm, setEditForm] = useState({
        valor_parcela: '',
        data_vencimento: '',
        pago: false
    });

    useEffect(() => {
        fetchSalesWithInstallments();
    }, []);

    const fetchSalesWithInstallments = async () => {
        try {
            // Buscar TODAS as vendas (não apenas FIADO)
            const { data: salesData, error: salesError } = await supabase
                .from('vendas')
                .select(`
          *,
          cliente:clientes(nome)
        `)
                .order('data_venda', { ascending: false });

            if (salesError) throw salesError;

            if (!salesData || salesData.length === 0) {
                setSales([]);
                return;
            }

            const salesWithInstallments: SaleWithInstallments[] = [];

            for (const sale of salesData) {
                const { data: installmentsData, error: installmentsError } = await supabase
                    .from('parcelas_venda')
                    .select('*')
                    .eq('venda_id', sale.id)
                    .order('numero_parcela');

                if (installmentsError) throw installmentsError;

                const parcelas = installmentsData || [];
                const totalPago = parcelas.filter(p => p.pago).reduce((sum, p) => sum + Number(p.valor_parcela), 0);
                const totalPendente = parcelas.filter(p => !p.pago).reduce((sum, p) => sum + Number(p.valor_parcela), 0);

                salesWithInstallments.push({
                    ...sale,
                    parcelas,
                    totalPago,
                    totalPendente
                });
            }

            setSales(salesWithInstallments);
        } catch (error) {
            console.error('Erro ao buscar vendas parceladas:', error);
            alert('Erro ao carregar vendas parceladas');
        } finally {
            setLoading(false);
        }
    };

    const handleEditInstallment = (installment: Installment) => {
        setEditingInstallment(installment);
        setEditForm({
            valor_parcela: installment.valor_parcela.toString(),
            data_vencimento: installment.data_vencimento,
            pago: installment.pago
        });
    };

    const handleSaveInstallment = async () => {
        if (!editingInstallment) return;

        try {
            const { error } = await supabase
                .from('parcelas_venda')
                .update({
                    valor_parcela: parseFloat(editForm.valor_parcela),
                    data_vencimento: editForm.data_vencimento,
                    pago: editForm.pago,
                    data_pagamento: editForm.pago ? new Date().toISOString().split('T')[0] : null
                })
                .eq('id', editingInstallment.id);

            if (error) throw error;

            alert('✅ Parcela atualizada com sucesso!');
            setEditingInstallment(null);
            fetchSalesWithInstallments();
        } catch (error: any) {
            console.error('Erro ao atualizar parcela:', error);
            alert('Erro ao atualizar parcela: ' + error.message);
        }
    };

    const handleTogglePaid = async (installment: Installment) => {
        try {
            const { error } = await supabase
                .from('parcelas_venda')
                .update({
                    pago: !installment.pago,
                    data_pagamento: !installment.pago ? new Date().toISOString().split('T')[0] : null
                })
                .eq('id', installment.id);

            if (error) throw error;

            fetchSalesWithInstallments();
        } catch (error: any) {
            console.error('Erro ao atualizar pagamento:', error);
            alert('Erro ao atualizar pagamento: ' + error.message);
        }
    };

    const handleDeleteSale = async (saleId: string, clientName: string) => {
        const confirmDelete = window.confirm(
            `Tem certeza que deseja excluir esta venda do cliente ${clientName}?\n\n` +
            `ATENÇÃO: Isto irá excluir a venda, todas as parcelas associadas e os itens vendidos. Esta ação não pode ser desfeita!`
        );

        if (!confirmDelete) return;

        try {
            const { error } = await supabase
                .from('vendas')
                .delete()
                .eq('id', saleId);

            if (error) throw error;

            alert('✅ Venda excluída com sucesso!');
            fetchSalesWithInstallments();
        } catch (error: any) {
            console.error('Erro ao excluir venda:', error);
            alert('Erro ao excluir venda: ' + error.message);
        }
    };

    const handleDownloadReceipt = async (sale: SaleWithInstallments) => {
        try {
            const receiptElement = document.getElementById(`receipt-${sale.id}`);

            if (!receiptElement) {
                alert('❌ Erro ao localizar o recibo. Tente novamente.');
                return;
            }

            // Converter para canvas com alta qualidade
            const canvas = await html2canvas(receiptElement, {
                backgroundColor: '#ffffff',
                scale: 2, // Alta qualidade
                logging: false,
                useCORS: true,
                allowTaint: true
            });

            // Converter para PNG
            const image = canvas.toDataURL('image/png');

            // Criar link de download
            const link = document.createElement('a');
            const clientName = sale.cliente.nome.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            const date = new Date(sale.data_venda).toLocaleDateString('pt-BR').replace(/\//g, '-');
            link.download = `resumo_venda_${clientName}_${date}.png`;
            link.href = image;
            link.click();

            alert('✅ Resumo baixado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao gerar resumo:', error);
            alert('❌ Erro ao gerar resumo. Tente novamente.');
        }
    };

    const isOverdue = (installment: Installment) => {
        if (installment.pago) return false;
        const today = new Date();
        const dueDate = new Date(installment.data_vencimento);
        return dueDate < today;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Carregando vendas parceladas...</p>
            </div>
        );
    }

    // Filtrar vendas baseado no filtro selecionado
    const filteredSales = sales.filter(sale => {
        if (filter === 'TODAS') return true;
        if (filter === 'PARCELADAS') return sale.forma_pagamento === 'FIADO';
        if (filter === 'AVISTA') return sale.forma_pagamento !== 'FIADO';
        return true;
    });

    // Helper para determinar se é venda à vista
    const isAVista = (sale: Sale) => sale.forma_pagamento !== 'FIADO';

    if (sales.length === 0) {
        return (
            <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Crediário</h2>
                <div className="bg-white p-12 rounded-lg shadow-md text-center">
                    <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma venda encontrada</p>
                    <p className="text-gray-400 mt-2">Todas as vendas aparecerão aqui para rastreabilidade</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Crediário</h2>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('TODAS')}
                        className={`px-4 py-2 rounded-md font-medium transition-colors ${filter === 'TODAS'
                            ? 'bg-pink-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Todas ({sales.length})
                    </button>
                    <button
                        onClick={() => setFilter('PARCELADAS')}
                        className={`px-4 py-2 rounded-md font-medium transition-colors ${filter === 'PARCELADAS'
                            ? 'bg-pink-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        Parceladas ({sales.filter(s => s.forma_pagamento === 'FIADO').length})
                    </button>
                    <button
                        onClick={() => setFilter('AVISTA')}
                        className={`px-4 py-2 rounded-md font-medium transition-colors ${filter === 'AVISTA'
                            ? 'bg-pink-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        À Vista ({sales.filter(s => s.forma_pagamento !== 'FIADO').length})
                    </button>
                </div>
            </div>

            {filteredSales.length === 0 ? (
                <div className="bg-white p-12 rounded-lg shadow-md text-center">
                    <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">Nenhuma venda encontrada neste filtro</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredSales.map((sale) => (
                        <div key={sale.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                            <div
                                onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)}
                                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 grid grid-cols-4 gap-4">
                                        <div className="flex items-center gap-2">
                                            <User className="w-5 h-5 text-pink-600" />
                                            <div>
                                                <p className="text-sm text-gray-500">Cliente</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-semibold text-gray-800">{sale.cliente.nome}</p>
                                                    {isAVista(sale) && (
                                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                                                            À Vista
                                                        </span>
                                                    )}
                                                    {!isAVista(sale) && (
                                                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
                                                            Parcelado
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-5 h-5 text-pink-600" />
                                            <div>
                                                <p className="text-sm text-gray-500">Data da Venda</p>
                                                <p className="font-semibold text-gray-800">{formatDate(sale.data_venda)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 text-pink-600" />
                                            <div>
                                                <p className="text-sm text-gray-500">Valor Total</p>
                                                <p className="font-semibold text-gray-800">R$ {sale.valor_total.toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 mb-1">Status</p>
                                            <div className="flex gap-2 text-xs">
                                                <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                                                    Pago: R$ {sale.totalPago.toFixed(2)}
                                                </span>
                                                <span className="bg-red-100 text-red-700 px-2 py-1 rounded">
                                                    Pendente: R$ {sale.totalPendente.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadReceipt(sale);
                                            }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Baixar resumo em PNG"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSale(sale.id, sale.cliente.nome);
                                            }}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Excluir venda"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                        {expandedSale === sale.id ? (
                                            <ChevronUp className="w-6 h-6 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-6 h-6 text-gray-400" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {expandedSale === sale.id && (
                                <div className="border-t border-gray-200 p-4 bg-gray-50">
                                    <h4 className="font-semibold text-gray-800 mb-4">
                                        Parcelas ({sale.parcelas.length}x)
                                    </h4>
                                    <div className="space-y-2">
                                        {sale.parcelas.map((installment) => (
                                            <div
                                                key={installment.id}
                                                className={`bg-white p-3 rounded-md border ${installment.pago
                                                    ? 'border-green-200'
                                                    : isOverdue(installment)
                                                        ? 'border-red-300 bg-red-50'
                                                        : 'border-gray-200'
                                                    }`}
                                            >
                                                {editingInstallment?.id === installment.id ? (
                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div>
                                                                <label className="block text-xs text-gray-600 mb-1">Valor</label>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={editForm.valor_parcela}
                                                                    onChange={(e) => setEditForm({ ...editForm, valor_parcela: e.target.value })}
                                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-600 mb-1">Vencimento</label>
                                                                <input
                                                                    type="date"
                                                                    value={editForm.data_vencimento}
                                                                    onChange={(e) => setEditForm({ ...editForm, data_vencimento: e.target.value })}
                                                                    className="w-full px-2 py-1 border rounded text-sm"
                                                                />
                                                            </div>
                                                            <div className="flex items-end">
                                                                <label className="flex items-center gap-2 cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={editForm.pago}
                                                                        onChange={(e) => setEditForm({ ...editForm, pago: e.target.checked })}
                                                                        className="w-4 h-4"
                                                                    />
                                                                    <span className="text-sm">Pago</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={handleSaveInstallment}
                                                                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                                            >
                                                                Salvar
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingInstallment(null)}
                                                                className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400"
                                                            >
                                                                Cancelar
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-sm font-semibold text-gray-700">
                                                                {installment.numero_parcela}ª parcela
                                                            </span>
                                                            <span className="text-sm font-bold text-gray-800">
                                                                R$ {Number(installment.valor_parcela).toFixed(2)}
                                                            </span>
                                                            <span className="text-sm text-gray-600">
                                                                Vencimento: {formatDate(installment.data_vencimento)}
                                                            </span>
                                                            {installment.pago && installment.data_pagamento && (
                                                                <span className="text-xs text-green-600">
                                                                    Pago em: {formatDate(installment.data_pagamento)}
                                                                </span>
                                                            )}
                                                            {isOverdue(installment) && (
                                                                <span className="text-xs text-red-600 font-semibold">ATRASADA</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleEditInstallment(installment)}
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                                title="Editar parcela"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleTogglePaid(installment)}
                                                                className={`p-1.5 rounded transition-colors ${installment.pago
                                                                    ? 'text-red-600 hover:bg-red-50'
                                                                    : 'text-green-600 hover:bg-green-50'
                                                                    }`}
                                                                title={installment.pago ? 'Marcar como não paga' : 'Marcar como paga'}
                                                            >
                                                                {installment.pago ? (
                                                                    <X className="w-4 h-4" />
                                                                ) : (
                                                                    <Check className="w-4 h-4" />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Recibos invisíveis para exportação */}
            {sales.map((sale) => (
                <SaleReceipt key={`receipt-${sale.id}`} sale={sale} />
            ))}
        </div>
    );
};

export default Credit;
