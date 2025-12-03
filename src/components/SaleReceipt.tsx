import React from 'react';
import { Calendar, DollarSign, User, Check, X, CreditCard } from 'lucide-react';

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

interface SaleWithInstallments extends Sale {
    parcelas: Installment[];
    totalPago: number;
    totalPendente: number;
}

interface SaleReceiptProps {
    sale: SaleWithInstallments;
}

const SaleReceipt: React.FC<SaleReceiptProps> = ({ sale }) => {
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const formatPaymentMethod = (method: string) => {
        const methods: { [key: string]: string } = {
            'PIX': 'PIX',
            'CARTAO_CREDITO': 'Cartão de Crédito',
            'CARTAO_DEBITO': 'Cartão de Débito',
            'DINHEIRO': 'Dinheiro',
            'FIADO': 'Parcelado'
        };
        return methods[method] || method;
    };

    const isAVista = sale.forma_pagamento !== 'FIADO';

    return (
        <div
            id={`receipt-${sale.id}`}
            style={{
                width: '600px',
                backgroundColor: '#ffffff',
                padding: '40px',
                fontFamily: 'Arial, sans-serif',
                color: '#1F2937',
                position: 'absolute',
                left: '-9999px',
                top: '0'
            }}
        >
            {/* Cabeçalho com Logo */}
            <div style={{ textAlign: 'center', marginBottom: '32px', borderBottom: '3px solid #EC4899', paddingBottom: '24px' }}>
                <img
                    src="/logo.png"
                    alt="Rubia Joias"
                    style={{ height: '80px', marginBottom: '16px' }}
                />
                <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#EC4899', margin: '0' }}>
                    Rubia Joias
                </h1>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#6B7280', margin: '8px 0 0 0' }}>
                    RESUMO DE VENDA
                </h2>
            </div>

            {/* Informações da Venda */}
            <div style={{ marginBottom: '32px', backgroundColor: '#F9FAFB', padding: '20px', borderRadius: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <User size={18} color="#EC4899" />
                            <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '600' }}>CLIENTE</span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1F2937' }}>
                            {sale.cliente.nome}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Calendar size={18} color="#EC4899" />
                            <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '600' }}>DATA DA VENDA</span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1F2937' }}>
                            {formatDate(sale.data_venda)}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <CreditCard size={18} color="#EC4899" />
                            <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '600' }}>FORMA DE PAGAMENTO</span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1F2937' }}>
                            {formatPaymentMethod(sale.forma_pagamento)}
                            {isAVista && (
                                <span style={{
                                    marginLeft: '8px',
                                    fontSize: '11px',
                                    backgroundColor: '#DBEAFE',
                                    color: '#1E40AF',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontWeight: '600'
                                }}>
                                    À VISTA
                                </span>
                            )}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <DollarSign size={18} color="#EC4899" />
                            <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '600' }}>VALOR TOTAL</span>
                        </div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#EC4899' }}>
                            R$ {sale.valor_total.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabela de Parcelas */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '16px', borderBottom: '2px solid #E5E7EB', paddingBottom: '8px' }}>
                    PARCELAS ({sale.parcelas.length}x)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#F3F4F6' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6B7280', border: '1px solid #E5E7EB' }}>Nº</th>
                            <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#6B7280', border: '1px solid #E5E7EB' }}>VALOR</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6B7280', border: '1px solid #E5E7EB' }}>VENCIMENTO</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6B7280', border: '1px solid #E5E7EB' }}>PAGAMENTO</th>
                            <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6B7280', border: '1px solid #E5E7EB' }}>STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sale.parcelas.map((parcela, index) => (
                            <tr key={parcela.id} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#F9FAFB' }}>
                                <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600', color: '#1F2937', border: '1px solid #E5E7EB' }}>
                                    {parcela.numero_parcela}ª
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#1F2937', border: '1px solid #E5E7EB' }}>
                                    R$ {Number(parcela.valor_parcela).toFixed(2)}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#4B5563', border: '1px solid #E5E7EB' }}>
                                    {formatDate(parcela.data_vencimento)}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '13px', color: '#4B5563', border: '1px solid #E5E7EB' }}>
                                    {parcela.data_pagamento ? formatDate(parcela.data_pagamento) : '-'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
                                    {parcela.pago ? (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            backgroundColor: '#D1FAE5',
                                            color: '#065F46',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            <Check size={14} /> PAGO
                                        </span>
                                    ) : (
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            backgroundColor: '#FEE2E2',
                                            color: '#991B1B',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: '600'
                                        }}>
                                            <X size={14} /> PENDENTE
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Observações */}
                {sale.parcelas[0]?.observacoes && (
                    <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#FEF3C7', borderLeft: '4px solid #F59E0B', fontSize: '12px', color: '#92400E' }}>
                        <strong>Obs:</strong> {sale.parcelas[0].observacoes}
                    </div>
                )}
            </div>

            {/* Resumo Financeiro */}
            <div style={{ marginBottom: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: '#D1FAE5', padding: '16px', borderRadius: '8px', border: '2px solid #10B981' }}>
                    <div style={{ fontSize: '12px', color: '#065F46', fontWeight: '600', marginBottom: '4px' }}>TOTAL PAGO</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#065F46' }}>
                        R$ {sale.totalPago.toFixed(2)}
                    </div>
                </div>
                <div style={{ backgroundColor: '#FEE2E2', padding: '16px', borderRadius: '8px', border: '2px solid #EF4444' }}>
                    <div style={{ fontSize: '12px', color: '#991B1B', fontWeight: '600', marginBottom: '4px' }}>TOTAL PENDENTE</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#991B1B' }}>
                        R$ {sale.totalPendente.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Rodapé */}
            <div style={{ borderTop: '2px solid #E5E7EB', paddingTop: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '8px' }}>
                    Documento emitido em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                </div>
                <div style={{ fontSize: '10px', color: '#D1D5DB' }}>
                    Este documento é apenas um resumo da venda para controle interno
                </div>
            </div>
        </div>
    );
};

export default SaleReceipt;
