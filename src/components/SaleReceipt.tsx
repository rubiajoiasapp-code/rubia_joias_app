import React from 'react';

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

interface SaleItem {
    id: string;
    quantidade: number;
    valor_unitario: number;
    subtotal?: number;
    produto: {
        descricao: string;
        categoria: string | null;
        codigo: string | null;
    } | null;
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
    itens: SaleItem[];
    totalPago: number;
    totalPendente: number;
}

interface SaleReceiptProps {
    sale: SaleWithInstallments;
}

// Paleta da marca
const COLORS = {
    primary: '#EC4899',
    primaryDark: '#BE185D',
    primaryLight: '#FCE7F3',
    text: '#111827',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
    border: '#E5E7EB',
    bgSoft: '#F9FAFB',
    bgAlt: '#FAF5FF',
    success: '#059669',
    successBg: '#D1FAE5',
    danger: '#DC2626',
    dangerBg: '#FEE2E2',
    warningBg: '#FEF3C7',
    warningBorder: '#F59E0B',
    warningText: '#92400E'
};

const SaleReceipt: React.FC<SaleReceiptProps> = ({ sale }) => {
    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        const cleanDate = dateString.split('T')[0];
        const [year, month, day] = cleanDate.split('-');
        return `${day}/${month}/${year}`;
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

    const itemSubtotal = (item: SaleItem): number => {
        if (typeof item.subtotal === 'number') return item.subtotal;
        return item.quantidade * item.valor_unitario;
    };

    const produtosSubtotal = sale.itens.reduce((sum, i) => sum + itemSubtotal(i), 0);
    const totalItens = sale.itens.reduce((sum, i) => sum + i.quantidade, 0);
    const possuiDesconto = Math.abs(produtosSubtotal - sale.valor_total) > 0.01 && produtosSubtotal > 0;

    return (
        <div
            id={`receipt-${sale.id}`}
            style={{
                width: '640px',
                backgroundColor: '#ffffff',
                padding: '0',
                fontFamily: '"Helvetica Neue", Arial, sans-serif',
                color: COLORS.text,
                position: 'absolute',
                left: '-9999px',
                top: '0',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
        >
            {/* Header com faixa colorida */}
            <div style={{
                background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
                padding: '32px 40px',
                color: '#ffffff',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <img
                            src="/logo.png"
                            alt="Rubia Joias"
                            style={{ height: '64px', backgroundColor: '#ffffff', borderRadius: '8px', padding: '4px' }}
                        />
                        <div>
                            <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '0.5px', lineHeight: 1 }}>
                                Rubia Joias
                            </div>
                            <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '4px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                                Elegância e Sofisticação
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', opacity: 0.8, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            Resumo de Venda
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                            #{sale.id.slice(0, 8).toUpperCase()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Corpo principal com padding */}
            <div style={{ padding: '28px 40px 32px 40px' }}>

                {/* Informações da Venda — cards lado a lado */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '24px'
                }}>
                    <div style={{
                        backgroundColor: COLORS.bgSoft,
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `1px solid ${COLORS.border}`
                    }}>
                        <div style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Cliente
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: COLORS.text }}>
                            {sale.cliente.nome}
                        </div>
                    </div>
                    <div style={{
                        backgroundColor: COLORS.bgSoft,
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `1px solid ${COLORS.border}`
                    }}>
                        <div style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Data da Venda
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: COLORS.text }}>
                            {formatDate(sale.data_venda)}
                        </div>
                    </div>
                    <div style={{
                        backgroundColor: COLORS.bgSoft,
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `1px solid ${COLORS.border}`
                    }}>
                        <div style={{ fontSize: '10px', color: COLORS.textMuted, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Forma de Pagamento
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 'bold', color: COLORS.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {formatPaymentMethod(sale.forma_pagamento)}
                            {isAVista && (
                                <span style={{
                                    fontSize: '9px',
                                    backgroundColor: '#DBEAFE',
                                    color: '#1E40AF',
                                    padding: '3px 8px',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    letterSpacing: '0.5px'
                                }}>
                                    À VISTA
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{
                        background: `linear-gradient(135deg, ${COLORS.primaryLight} 0%, #FBCFE8 100%)`,
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: `1px solid ${COLORS.primary}`
                    }}>
                        <div style={{ fontSize: '10px', color: COLORS.primaryDark, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Valor Total
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: COLORS.primaryDark, lineHeight: 1 }}>
                            R$ {sale.valor_total.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Tabela de Produtos */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        marginBottom: '12px',
                        paddingBottom: '8px',
                        borderBottom: `2px solid ${COLORS.primary}`
                    }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, letterSpacing: '1px', textTransform: 'uppercase' }}>
                            Produtos
                        </div>
                        <div style={{ fontSize: '11px', color: COLORS.textMuted }}>
                            {sale.itens.length} {sale.itens.length === 1 ? 'item' : 'itens'} • {totalItens} {totalItens === 1 ? 'unidade' : 'unidades'}
                        </div>
                    </div>

                    {sale.itens.length === 0 ? (
                        <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: COLORS.textFaint,
                            fontSize: '12px',
                            fontStyle: 'italic',
                            backgroundColor: COLORS.bgSoft,
                            borderRadius: '8px'
                        }}>
                            Nenhum item registrado nesta venda
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderTopLeftRadius: '8px', borderBottom: `1px solid ${COLORS.border}` }}>
                                        Produto
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderBottom: `1px solid ${COLORS.border}`, width: '60px' }}>
                                        Qtd
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderBottom: `1px solid ${COLORS.border}`, width: '100px' }}>
                                        Unit.
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderTopRightRadius: '8px', borderBottom: `1px solid ${COLORS.border}`, width: '110px' }}>
                                        Subtotal
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.itens.map((item, index) => {
                                    const isLast = index === sale.itens.length - 1;
                                    const rowBorder = isLast ? 'none' : `1px solid ${COLORS.border}`;
                                    return (
                                        <tr key={item.id}>
                                            <td style={{ padding: '12px', fontSize: '13px', color: COLORS.text, borderBottom: rowBorder, verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: 600 }}>
                                                    {item.produto?.descricao || 'Produto não identificado'}
                                                </div>
                                                {(item.produto?.categoria || item.produto?.codigo) && (
                                                    <div style={{ fontSize: '10px', color: COLORS.textFaint, marginTop: '2px' }}>
                                                        {item.produto?.categoria}
                                                        {item.produto?.categoria && item.produto?.codigo ? ' • ' : ''}
                                                        {item.produto?.codigo ? `Cód: ${item.produto.codigo}` : ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '12px', fontSize: '13px', color: COLORS.text, textAlign: 'center', borderBottom: rowBorder, fontWeight: 600 }}>
                                                {item.quantidade}
                                            </td>
                                            <td style={{ padding: '12px', fontSize: '13px', color: COLORS.textMuted, textAlign: 'right', borderBottom: rowBorder }}>
                                                R$ {item.valor_unitario.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '12px', fontSize: '13px', color: COLORS.text, textAlign: 'right', borderBottom: rowBorder, fontWeight: 700 }}>
                                                R$ {itemSubtotal(item).toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Linha de subtotal + desconto (quando aplicável) */}
                    {sale.itens.length > 0 && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px dashed ${COLORS.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px' }}>
                                <span>Subtotal dos produtos</span>
                                <span style={{ fontWeight: 600, color: COLORS.text }}>R$ {produtosSubtotal.toFixed(2)}</span>
                            </div>
                            {possuiDesconto && produtosSubtotal > sale.valor_total && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: COLORS.success, marginBottom: '4px' }}>
                                    <span>Desconto aplicado</span>
                                    <span style={{ fontWeight: 600 }}>- R$ {(produtosSubtotal - sale.valor_total).toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '6px', paddingTop: '6px', borderTop: `1px solid ${COLORS.border}` }}>
                                <span style={{ fontWeight: 700, color: COLORS.text }}>Total da venda</span>
                                <span style={{ fontWeight: 700, color: COLORS.primary }}>R$ {sale.valor_total.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Parcelas (só mostra se houver mais de uma ou se for fiado) */}
                {sale.parcelas.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginBottom: '12px',
                            paddingBottom: '8px',
                            borderBottom: `2px solid ${COLORS.primary}`
                        }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: COLORS.text, letterSpacing: '1px', textTransform: 'uppercase' }}>
                                Parcelas
                            </div>
                            <div style={{ fontSize: '11px', color: COLORS.textMuted }}>
                                {sale.parcelas.length}x
                            </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderTopLeftRadius: '8px', borderBottom: `1px solid ${COLORS.border}`, width: '50px' }}>
                                        Nº
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderBottom: `1px solid ${COLORS.border}` }}>
                                        Valor
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderBottom: `1px solid ${COLORS.border}` }}>
                                        Vencimento
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderBottom: `1px solid ${COLORS.border}` }}>
                                        Pagamento
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: COLORS.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', backgroundColor: COLORS.bgAlt, borderTopRightRadius: '8px', borderBottom: `1px solid ${COLORS.border}` }}>
                                        Status
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.parcelas.map((parcela, index) => {
                                    const isLast = index === sale.parcelas.length - 1;
                                    const rowBorder = isLast ? 'none' : `1px solid ${COLORS.border}`;
                                    return (
                                        <tr key={parcela.id}>
                                            <td style={{ padding: '10px 12px', fontSize: '12px', color: COLORS.text, fontWeight: 700, borderBottom: rowBorder }}>
                                                {parcela.numero_parcela === 0 ? '—' : `${parcela.numero_parcela}ª`}
                                            </td>
                                            <td style={{ padding: '10px 12px', fontSize: '12px', color: COLORS.text, textAlign: 'right', fontWeight: 700, borderBottom: rowBorder }}>
                                                R$ {Number(parcela.valor_parcela).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '10px 12px', fontSize: '11px', color: COLORS.textMuted, textAlign: 'center', borderBottom: rowBorder }}>
                                                {parcela.numero_parcela === 0 ? (
                                                    <span style={{ color: COLORS.success, fontWeight: 600 }}>ENTRADA</span>
                                                ) : (
                                                    formatDate(parcela.data_vencimento)
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 12px', fontSize: '11px', color: COLORS.textMuted, textAlign: 'center', borderBottom: rowBorder }}>
                                                {parcela.data_pagamento ? formatDate(parcela.data_pagamento) : '—'}
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: rowBorder }}>
                                                {parcela.pago ? (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        backgroundColor: COLORS.successBg,
                                                        color: COLORS.success,
                                                        padding: '3px 10px',
                                                        borderRadius: '10px',
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        PAGO
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        backgroundColor: COLORS.dangerBg,
                                                        color: COLORS.danger,
                                                        padding: '3px 10px',
                                                        borderRadius: '10px',
                                                        fontSize: '10px',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.5px'
                                                    }}>
                                                        PENDENTE
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Observações */}
                        {sale.parcelas[0]?.observacoes && (
                            <div style={{
                                marginTop: '10px',
                                padding: '10px 14px',
                                backgroundColor: COLORS.warningBg,
                                borderLeft: `3px solid ${COLORS.warningBorder}`,
                                fontSize: '11px',
                                color: COLORS.warningText,
                                borderRadius: '4px'
                            }}>
                                <strong>Obs:</strong> {sale.parcelas[0].observacoes}
                            </div>
                        )}
                    </div>
                )}

                {/* Resumo Financeiro */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginBottom: '20px'
                }}>
                    <div style={{
                        backgroundColor: COLORS.successBg,
                        padding: '16px 20px',
                        borderRadius: '10px',
                        border: `2px solid ${COLORS.success}`
                    }}>
                        <div style={{ fontSize: '10px', color: COLORS.success, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Total Pago
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: COLORS.success, lineHeight: 1 }}>
                            R$ {sale.totalPago.toFixed(2)}
                        </div>
                    </div>
                    <div style={{
                        backgroundColor: COLORS.dangerBg,
                        padding: '16px 20px',
                        borderRadius: '10px',
                        border: `2px solid ${COLORS.danger}`
                    }}>
                        <div style={{ fontSize: '10px', color: COLORS.danger, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Total Pendente
                        </div>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: COLORS.danger, lineHeight: 1 }}>
                            R$ {sale.totalPendente.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Rodapé */}
                <div style={{
                    borderTop: `1px solid ${COLORS.border}`,
                    paddingTop: '16px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '10px', color: COLORS.textMuted, marginBottom: '4px' }}>
                        Documento emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '9px', color: COLORS.textFaint }}>
                        Este documento é apenas um resumo da venda para controle interno • Rubia Joias
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaleReceipt;
