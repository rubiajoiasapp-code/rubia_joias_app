import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format, parseISO, isSameMonth, startOfMonth, isBefore, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Installment {
    id: string;
    venda_id: string;
    numero_parcela: number;
    valor_parcela: number;
    data_vencimento: string;
    pago: boolean;
    observacoes: string | null;
    venda: {
        cliente: {
            nome: string;
        } | null;
    } | null;
}

const ExpirationDates: React.FC = () => {
    const [installments, setInstallments] = useState<Installment[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<Date>(startOfMonth(new Date()));
    const [availableMonths, setAvailableMonths] = useState<Date[]>([]);

    useEffect(() => {
        fetchInstallments();
    }, []);

    const fetchInstallments = async () => {
        try {
            // Fetch installments with client data
            // We need to fetch ALL pending or recent installments to build the timeline
            // For now, let's fetch everything that is not paid, or paid recently?
            // User query: "colocar os vencimentos em ordem cronológica"
            const { data, error } = await supabase
                .from('parcelas_venda')
                .select(`
                    id,
                    venda_id,
                    numero_parcela,
                    valor_parcela,
                    data_vencimento,
                    pago,
                    observacoes,
                    venda:vendas (
                        cliente:clientes (
                            nome
                        )
                    )
                `)
                .order('data_vencimento', { ascending: true });

            if (error) throw error;

            const fetchedData = (data || []) as any[]; // Cast to handle nested types if needed
            setInstallments(fetchedData);

            // Extract unique months from data
            const monthsSet = new Set<string>();
            fetchedData.forEach(item => {
                const date = startOfMonth(parseISO(item.data_vencimento));
                monthsSet.add(date.toISOString());
            });

            // Ensure current month is always available even if empty
            monthsSet.add(startOfMonth(new Date()).toISOString());

            const months = Array.from(monthsSet)
                .map(dateStr => new Date(dateStr))
                .sort((a, b) => a.getTime() - b.getTime());

            setAvailableMonths(months);

            // If selected month is not in list (unlikely due to add above), default to first available or current
            // Logic: Try to stay on current month, otherwise closest?
            // For now default state is current month.
        } catch (error) {
            console.error('Error fetching installments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsPaid = async (id: string) => {
        try {
            const { error } = await supabase
                .from('parcelas_venda')
                .update({
                    pago: true,
                    data_pagamento: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;

            // Update local state
            setInstallments(prev => prev.map(item =>
                item.id === id ? { ...item, pago: true } : item
            ));
        } catch (error) {
            console.error('Error updating installment:', error);
            alert('Erro ao marcar como pago');
        }
    };

    // Filter installments by selected month
    const currentMonthInstallments = installments.filter(item =>
        isSameMonth(parseISO(item.data_vencimento), selectedMonth)
    );

    // Calculate totals for the month
    const totalDue = currentMonthInstallments.reduce((acc, curr) => acc + curr.valor_parcela, 0);
    const totalPaid = currentMonthInstallments.filter(i => i.pago).reduce((acc, curr) => acc + curr.valor_parcela, 0);
    const totalPending = totalDue - totalPaid;

    // Helper to determine status color/icon
    const getStatusInfo = (item: Installment) => {
        const dueDate = parseISO(item.data_vencimento);

        if (item.pago) {
            return { color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle, label: 'Pago' };
        }

        if (isBefore(dueDate, new Date()) && !isToday(dueDate)) {
            return { color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle, label: 'Atrasado' };
        }

        if (isToday(dueDate)) {
            return { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Clock, label: 'Vence Hoje' };
        }

        return { color: 'text-blue-600', bg: 'bg-blue-100', icon: Calendar, label: 'A Vencer' };
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
                <Calendar className="w-8 h-8 mr-3 text-pink-600" />
                Vencimentos
            </h2>

            {/* Month Tabs */}
            <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
                <div className="flex overflow-x-auto p-2 gap-2 hide-scrollbar">
                    {availableMonths.map((month) => {
                        const isSelected = isSameMonth(month, selectedMonth);
                        return (
                            <button
                                key={month.toISOString()}
                                onClick={() => setSelectedMonth(month)}
                                className={`
                                    px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-all flex flex-col items-center min-w-[120px]
                                    ${isSelected
                                        ? 'bg-pink-600 text-white shadow-md transform scale-105'
                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    }
                                `}
                            >
                                <span className="text-sm capitalize">
                                    {format(month, 'MMMM', { locale: ptBR })}
                                </span>
                                <span className="text-xs opacity-80">
                                    {format(month, 'yyyy')}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content for Selected Month */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary Card */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 capitalize">
                            Resumo de {format(selectedMonth, 'MMMM', { locale: ptBR })}
                        </h3>

                        <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-500 mb-1">Total a Receber</div>
                                <div className="text-2xl font-bold text-gray-800">
                                    R$ {totalDue.toFixed(2)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <div className="text-sm text-green-600 mb-1">Recebido</div>
                                    <div className="text-xl font-bold text-green-700">
                                        R$ {totalPaid.toFixed(2)}
                                    </div>
                                </div>
                                <div className="p-4 bg-red-50 rounded-lg">
                                    <div className="text-sm text-red-600 mb-1">Pendente</div>
                                    <div className="text-xl font-bold text-red-700">
                                        R$ {totalPending.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* List */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">
                                Carregando vencimentos...
                            </div>
                        ) : currentMonthInstallments.length === 0 ? (
                            <div className="p-12 text-center">
                                <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 text-lg">Nenhum vencimento para este mês.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {currentMonthInstallments.map((item) => {
                                    const status = getStatusInfo(item);
                                    const StatusIcon = status.icon;

                                    return (
                                        <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-3 rounded-full ${status.bg} shrink-0`}>
                                                    <StatusIcon className={`w-6 h-6 ${status.color}`} />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-800">
                                                        {item.venda?.cliente?.nome || 'Cliente Não Identificado'}
                                                    </h4>
                                                    <p className="text-sm text-gray-500">
                                                        Parcela {item.numero_parcela} • Vencimento: {format(parseISO(item.data_vencimento), 'dd/MM/yyyy')}
                                                    </p>
                                                    {item.observacoes && (
                                                        <p className="text-xs text-gray-400 mt-1 italic">
                                                            Obs: {item.observacoes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                                <div className="text-right">
                                                    <div className="font-bold text-gray-800 text-lg">
                                                        R$ {item.valor_parcela.toFixed(2)}
                                                    </div>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </div>

                                                {!item.pago && (
                                                    <button
                                                        onClick={() => handleMarkAsPaid(item.id)}
                                                        className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-all"
                                                        title="Marcar como Pago"
                                                    >
                                                        <CheckCircle className="w-6 h-6" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpirationDates;
