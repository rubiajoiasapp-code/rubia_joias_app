import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Plus,
    Trash2,
    Edit2,
    ChevronDown,
    ChevronUp,
    Check,
    X,
    Save,
    Package
} from 'lucide-react';

interface Expense {
    id: string;
    fornecedor_id: string;
    fornecedor: { nome: string };
    descricao: string;
    valor_total: number;
    numero_parcelas: number;
    numero_nota_fiscal?: string;
    forma_pagamento?: string;
    created_at: string;
}

interface Installment {
    id: string;
    conta_pagar_id: string;
    numero_parcela: number;
    valor_parcela: number;
    data_vencimento: string;
    pago: boolean;
}

interface ProductItem {
    tempId?: number;
    descricao: string;
    categoria: string;
    quantidade: number;
    valor_custo: number;
}

const Financial: React.FC = () => {
    // Estados para o formulário
    const [supplierName, setSupplierName] = useState('');
    const [supplierCpfCnpj, setSupplierCpfCnpj] = useState('');
    const [supplierPhone, setSupplierPhone] = useState('');
    const [supplierAddress, setSupplierAddress] = useState('');
    const [description, setDescription] = useState('');
    const [totalValue, setTotalValue] = useState('');
    const [installmentsCount, setInstallmentsCount] = useState(1);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('DINHEIRO');

    // Estados para produtos
    const [productItems, setProductItems] = useState<ProductItem[]>([]);
    const [tempIdCounter, setTempIdCounter] = useState(1);

    // Estados para histórico
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expandedExpense, setExpandedExpense] = useState<string | null>(null);
    const [installmentsByExpense, setInstallmentsByExpense] = useState<{ [key: string]: Installment[] }>({});

    // Estados para edição de parcelas
    const [editingInstallment, setEditingInstallment] = useState<string | null>(null);
    const [editData, setEditData] = useState({ valor_parcela: '', data_vencimento: '' });

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            const { data, error } = await supabase
                .from('contas_pagar')
                .select(`
                    *,
                    fornecedor:fornecedores(nome)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setExpenses(data || []);
        } catch (error) {
            console.error('Error fetching expenses:', error);
        }
    };

    const fetchInstallments = async (expenseId: string) => {
        try {
            const { data, error } = await supabase
                .from('parcelas_pagar')
                .select('*')
                .eq('conta_pagar_id', expenseId)
                .order('numero_parcela', { ascending: true });

            if (error) throw error;

            setInstallmentsByExpense(prev => ({
                ...prev,
                [expenseId]: data || []
            }));
        } catch (error) {
            console.error('Error fetching installments:', error);
        }
    };

    const toggleExpense = (expenseId: string) => {
        if (expandedExpense === expenseId) {
            setExpandedExpense(null);
        } else {
            setExpandedExpense(expenseId);
            if (!installmentsByExpense[expenseId]) {
                fetchInstallments(expenseId);
            }
        }
    };

    const generateProductCode = () => {
        return Math.floor(10000000 + Math.random() * 90000000).toString();
    };

    const addProductItem = () => {
        setProductItems([...productItems, {
            tempId: tempIdCounter,
            descricao: '',
            categoria: '',
            quantidade: 1,
            valor_custo: 0
        }]);
        setTempIdCounter(tempIdCounter + 1);
    };

    const removeProductItem = (tempId: number) => {
        setProductItems(productItems.filter(item => item.tempId !== tempId));
    };

    const updateProductItem = (tempId: number, field: keyof ProductItem, value: any) => {
        setProductItems(productItems.map(item =>
            item.tempId === tempId ? { ...item, [field]: value } : item
        ));
    };

    const calculateTotalFromProducts = () => {
        const total = productItems.reduce((sum, item) => {
            return sum + (item.quantidade * item.valor_custo);
        }, 0);
        setTotalValue(total.toFixed(2));
    };

    // Atualizar total quando produtos mudarem
    useEffect(() => {
        if (productItems.length > 0) {
            calculateTotalFromProducts();
        }
    }, [productItems]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            // 1. Verificar se fornecedor já existe pelo nome
            let supplierId: string;
            const { data: existingSupplier } = await supabase
                .from('fornecedores')
                .select('id')
                .eq('nome', supplierName)
                .single();

            if (existingSupplier) {
                supplierId = existingSupplier.id;
            } else {
                // 2. Criar novo fornecedor
                const { data: newSupplier, error: supplierError } = await supabase
                    .from('fornecedores')
                    .insert([{
                        nome: supplierName,
                        cpf_cnpj: supplierCpfCnpj,
                        telefone: supplierPhone,
                        endereco: supplierAddress
                    }])
                    .select()
                    .single();

                if (supplierError) throw supplierError;
                supplierId = newSupplier.id;
            }

            // 3. Criar conta a pagar
            const { data: expenseData, error: expenseError } = await supabase
                .from('contas_pagar')
                .insert([{
                    fornecedor_id: supplierId,
                    descricao: description,
                    valor_total: parseFloat(totalValue),
                    numero_parcelas: installmentsCount,
                    numero_nota_fiscal: invoiceNumber || null,
                    forma_pagamento: paymentMethod
                }])
                .select()
                .single();

            if (expenseError) throw expenseError;

            // 4. Gerar parcelas
            const valorParcela = parseFloat(totalValue) / installmentsCount;
            const parcelas = [];

            for (let i = 1; i <= installmentsCount; i++) {
                const dataVencimento = new Date();
                dataVencimento.setMonth(dataVencimento.getMonth() + i);

                parcelas.push({
                    conta_pagar_id: expenseData.id,
                    numero_parcela: i,
                    valor_parcela: valorParcela,
                    data_vencimento: dataVencimento.toISOString().split('T')[0],
                    pago: false
                });
            }

            const { error: installmentsError } = await supabase
                .from('parcelas_pagar')
                .insert(parcelas);

            if (installmentsError) throw installmentsError;

            // 5. Inserir produtos no estoque (se houver)
            if (productItems.length > 0) {
                const productsToInsert = productItems.map(item => ({
                    codigo: generateProductCode(),
                    descricao: item.descricao,
                    categoria: item.categoria,
                    valor_custo: item.valor_custo,
                    valor_venda: item.valor_custo * 2, // Preço de venda sugerido (2x o custo)
                    quantidade_estoque: item.quantidade,
                    image_url: null,
                    conta_pagar_id: expenseData.id // Vincular produto à nota fiscal/fornecedor
                }));

                const { error: productsError } = await supabase
                    .from('produtos')
                    .insert(productsToInsert);

                if (productsError) throw productsError;
            }

            alert('✅ Despesa cadastrada com sucesso!');

            // Limpar formulário
            setSupplierName('');
            setSupplierCpfCnpj('');
            setSupplierPhone('');
            setSupplierAddress('');
            setDescription('');
            setTotalValue('');
            setInstallmentsCount(1);
            setInvoiceNumber('');
            setPaymentMethod('DINHEIRO');
            setProductItems([]);

            fetchExpenses();
        } catch (error: any) {
            console.error('Error creating expense:', error);
            alert('Erro ao cadastrar despesa: ' + error.message);
        }
    };

    const togglePaid = async (installmentId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('parcelas_pagar')
                .update({ pago: !currentStatus })
                .eq('id', installmentId);

            if (error) throw error;

            if (expandedExpense) {
                fetchInstallments(expandedExpense);
            }
        } catch (error) {
            console.error('Error updating installment:', error);
        }
    };

    const handleDeleteExpense = async (expenseId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta despesa?\n\nAs parcelas também serão excluídas.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('contas_pagar')
                .delete()
                .eq('id', expenseId);

            if (error) throw error;

            alert('✅ Despesa excluída com sucesso!');
            fetchExpenses();
        } catch (error: any) {
            console.error('Error deleting expense:', error);
            alert('Erro ao excluir despesa: ' + error.message);
        }
    };

    const startEditing = (installment: Installment) => {
        setEditingInstallment(installment.id);
        setEditData({
            valor_parcela: installment.valor_parcela.toString(),
            data_vencimento: installment.data_vencimento
        });
    };

    const cancelEditing = () => {
        setEditingInstallment(null);
        setEditData({ valor_parcela: '', data_vencimento: '' });
    };

    const saveInstallment = async (installmentId: string) => {
        try {
            const { error } = await supabase
                .from('parcelas_pagar')
                .update({
                    valor_parcela: parseFloat(editData.valor_parcela),
                    data_vencimento: editData.data_vencimento
                })
                .eq('id', installmentId);

            if (error) throw error;

            alert('✅ Parcela atualizada com sucesso!');
            cancelEditing();

            if (expandedExpense) {
                fetchInstallments(expandedExpense);
            }
        } catch (error: any) {
            console.error('Error updating installment:', error);
            alert('Erro ao atualizar parcela: ' + error.message);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Financeiro - Contas a Pagar</h2>

            {/* Formulário de Cadastro */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Cadastrar Despesa</h3>
                <form onSubmit={handleSubmit}>
                    {/* Dados do Fornecedor */}
                    <div className="mb-4">
                        <h4 className="font-medium text-gray-700 mb-2">Dados do Fornecedor</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Nome do Fornecedor"
                                value={supplierName}
                                onChange={(e) => setSupplierName(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                required
                            />
                            <input
                                type="text"
                                placeholder="CPF/CNPJ"
                                value={supplierCpfCnpj}
                                onChange={(e) => setSupplierCpfCnpj(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                            <input
                                type="text"
                                placeholder="Telefone"
                                value={supplierPhone}
                                onChange={(e) => setSupplierPhone(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                            <input
                                type="text"
                                placeholder="Endereço"
                                value={supplierAddress}
                                onChange={(e) => setSupplierAddress(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                    </div>

                    {/* Dados da Conta */}
                    <div className="mb-4">
                        <h4 className="font-medium text-gray-700 mb-2">Dados da Conta</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <input
                                type="text"
                                placeholder="Descrição"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                required
                            />
                            <input
                                type="text"
                                placeholder="Número da Nota Fiscal"
                                value={invoiceNumber}
                                onChange={(e) => setInvoiceNumber(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            >
                                <option value="DINHEIRO">Dinheiro</option>
                                <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                                <option value="CARTAO_DEBITO">Cartão de Débito</option>
                                <option value="PIX">PIX</option>
                                <option value="FIADO">Fiado</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <input
                                type="number"
                                step="0.01"
                                placeholder="Valor Total"
                                value={totalValue}
                                onChange={(e) => setTotalValue(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                required
                            />
                            <input
                                type="number"
                                placeholder="Número de Parcelas"
                                value={installmentsCount}
                                onChange={(e) => setInstallmentsCount(parseInt(e.target.value) || 1)}
                                className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                min="1"
                                required
                            />
                        </div>
                    </div>

                    {/* Produtos */}
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium text-gray-700 flex items-center">
                                <Package className="w-5 h-5 mr-2" />
                                Itens da Compra (Vão para o Estoque)
                            </h4>
                            <button
                                type="button"
                                onClick={addProductItem}
                                className="text-sm bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 flex items-center"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Adicionar Item
                            </button>
                        </div>

                        {productItems.length > 0 && (
                            <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-xs font-semibold text-gray-600">
                                <div className="col-span-3">Nome do Produto</div>
                                <div className="col-span-2">Categoria</div>
                                <div className="col-span-2">Quantidade</div>
                                <div className="col-span-2">Valor Unitário</div>
                                <div className="col-span-2">Valor Total</div>
                                <div className="col-span-1"></div>
                            </div>
                        )}

                        {productItems.map((item) => {
                            const valorTotal = item.quantidade * item.valor_custo;
                            return (
                                <div key={item.tempId} className="grid grid-cols-12 gap-2 mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                                    <input
                                        type="text"
                                        placeholder="Ex: Corrente de Prata"
                                        value={item.descricao}
                                        onChange={(e) => updateProductItem(item.tempId!, 'descricao', e.target.value)}
                                        className="col-span-3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Ex: Correntes"
                                        value={item.categoria}
                                        onChange={(e) => updateProductItem(item.tempId!, 'categoria', e.target.value)}
                                        className="col-span-2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={item.quantidade}
                                        onChange={(e) => updateProductItem(item.tempId!, 'quantidade', parseInt(e.target.value) || 0)}
                                        className="col-span-2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                        min="1"
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="R$ 0,00"
                                        value={item.valor_custo}
                                        onChange={(e) => updateProductItem(item.tempId!, 'valor_custo', parseFloat(e.target.value) || 0)}
                                        className="col-span-2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                    <div className="col-span-2 px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-semibold text-gray-700 flex items-center">
                                        R$ {valorTotal.toFixed(2)}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeProductItem(item.tempId!)}
                                        className="col-span-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded flex items-center justify-center"
                                        title="Remover item"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        type="submit"
                        className="bg-pink-600 text-white font-bold py-2 px-6 rounded-md hover:bg-pink-700 flex items-center"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Cadastrar Despesa
                    </button>
                </form>
            </div>

            {/* Histórico */}
            <div className="bg-white rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-gray-800 p-6 border-b">Histórico de Contas</h3>
                <div className="divide-y">
                    {expenses.map((expense) => (
                        <div key={expense.id} className="p-4">
                            <div
                                className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
                                onClick={() => toggleExpense(expense.id)}
                            >
                                <div className="flex-1">
                                    <h4 className="font-medium text-gray-800">{expense.fornecedor.nome}</h4>
                                    <p className="text-sm text-gray-600">{expense.descricao}</p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(expense.created_at).toLocaleDateString()} •
                                        {expense.numero_parcelas}x de R$ {(expense.valor_total / expense.numero_parcelas).toFixed(2)}
                                    </p>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className="text-lg font-bold text-gray-800">
                                        R$ {expense.valor_total.toFixed(2)}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteExpense(expense.id);
                                        }}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    {expandedExpense === expense.id ? (
                                        <ChevronUp className="w-5 h-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                            </div>

                            {/* Parcelas */}
                            {expandedExpense === expense.id && installmentsByExpense[expense.id] && (
                                <div className="mt-4 ml-4">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="p-2 text-left">Parcela</th>
                                                <th className="p-2 text-left">Vencimento</th>
                                                <th className="p-2 text-left">Valor</th>
                                                <th className="p-2 text-left">Status</th>
                                                <th className="p-2 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {installmentsByExpense[expense.id].map((installment) => (
                                                <tr key={installment.id} className="border-t">
                                                    <td className="p-2">{installment.numero_parcela}ª</td>

                                                    {editingInstallment === installment.id ? (
                                                        /* Edit Mode */
                                                        <>
                                                            <td className="p-2">
                                                                <input
                                                                    type="date"
                                                                    value={editData.data_vencimento}
                                                                    onChange={(e) => setEditData({ ...editData, data_vencimento: e.target.value })}
                                                                    className="px-2 py-1 border rounded text-sm w-full"
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={editData.valor_parcela}
                                                                    onChange={(e) => setEditData({ ...editData, valor_parcela: e.target.value })}
                                                                    className="px-2 py-1 border rounded text-sm w-full"
                                                                />
                                                            </td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2 text-center flex justify-center space-x-2">
                                                                <button
                                                                    onClick={() => saveInstallment(installment.id)}
                                                                    className="text-green-600 hover:bg-green-100 p-1 rounded"
                                                                    title="Salvar"
                                                                >
                                                                    <Save className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={cancelEditing}
                                                                    className="text-red-600 hover:bg-red-100 p-1 rounded"
                                                                    title="Cancelar"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        /* View Mode */
                                                        <>
                                                            <td className="p-2">{new Date(installment.data_vencimento).toLocaleDateString()}</td>
                                                            <td className="p-2">R$ {installment.valor_parcela.toFixed(2)}</td>
                                                            <td className="p-2">
                                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${installment.pago ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                    {installment.pago ? 'PAGO' : 'PENDENTE'}
                                                                </span>
                                                            </td>
                                                            <td className="p-2 text-center flex justify-center space-x-2">
                                                                <button
                                                                    onClick={() => togglePaid(installment.id, installment.pago)}
                                                                    className={`p-1 rounded ${installment.pago ? 'hover:bg-red-100 text-red-600' : 'hover:bg-green-100 text-green-600'}`}
                                                                    title={installment.pago ? "Marcar como não pago" : "Baixar parcela"}
                                                                >
                                                                    {installment.pago ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => startEditing(installment)}
                                                                    className="p-1 rounded hover:bg-gray-200 text-blue-600"
                                                                    title="Editar parcela"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}

                    {expenses.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            Nenhuma despesa cadastrada.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Financial;
