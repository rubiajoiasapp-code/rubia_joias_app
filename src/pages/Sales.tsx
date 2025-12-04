import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingCart, Search, QrCode, Package as PackageIcon, Trash2, CreditCard, Camera, X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

interface Product {
    id: string;
    codigo: string;
    descricao: string;
    categoria: string;
    valor_venda: number;
    quantidade_estoque: number;
    image_url: string | null;
}

interface Client {
    id: string;
    nome: string;
}

interface CartItem extends Product {
    quantity: number;
}

const Sales: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [selectedClient, setSelectedClient] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('PIX');
    const [installments, setInstallments] = useState<number>(1);
    const [downPayment, setDownPayment] = useState<number>(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        fetchProducts();
        fetchClients();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('produtos')
                .select('*')
                .gt('quantidade_estoque', 0)
                .order('descricao');

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
            alert('Erro ao carregar produtos.');
        } finally {
            setLoading(false);
        }
    };

    const fetchClients = async () => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('id, nome')
                .order('nome');

            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        }
    };

    const addToCart = (product: Product) => {
        const existingItem = cart.find(item => item.id === product.id);

        if (existingItem) {
            if (existingItem.quantity >= product.quantidade_estoque) {
                alert('Quantidade máxima em estoque atingida!');
                return;
            }
            setCart(cart.map(item =>
                item.id === product.id
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.id !== productId));
    };

    const updateQuantity = (productId: string, newQuantity: number) => {
        const product = products.find(p => p.id === productId);

        if (newQuantity < 1) {
            removeFromCart(productId);
            return;
        }

        if (product && newQuantity > product.quantidade_estoque) {
            alert('Quantidade não disponível em estoque!');
            return;
        }

        setCart(cart.map(item =>
            item.id === productId
                ? { ...item, quantity: newQuantity }
                : item
        ));
    };

    const calculateTotal = () => {
        return cart.reduce((total, item) => total + (item.valor_venda * item.quantity), 0);
    };

    const searchByQRCode = () => {
        if (!qrCode.trim()) return;

        const product = products.find(p => p.codigo === qrCode.trim());

        if (product) {
            addToCart(product);
            setQrCode('');
        } else {
            alert('Produto não encontrado com este código QR!');
        }
    };

    const handleScan = (result: any) => {
        if (result && result[0]?.rawValue) {
            const code = result[0].rawValue;
            const product = products.find(p => p.codigo === code);

            if (product) {
                addToCart(product);
                setShowScanner(false);
                alert(`✅ ${product.descricao} adicionado ao carrinho!`);
            } else {
                alert('Produto não encontrado com este código QR!');
                setShowScanner(false);
            }
        }
    };

    const handleScanError = (error: any) => {
        console.error('QR Scanner error:', error);
    };

    const filteredProducts = products.filter(product =>
        product.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleFinalizeSale = async () => {
        if (cart.length === 0) {
            alert('Adicione produtos ao carrinho!');
            return;
        }

        if (!selectedClient) {
            alert('Selecione um cliente!');
            return;
        }

        setProcessing(true);

        try {
            const total = calculateTotal();

            // 1. Criar a venda
            const { data: saleData, error: saleError } = await supabase
                .from('vendas')
                .insert([{
                    cliente_id: selectedClient,
                    data_venda: new Date().toISOString(),
                    valor_total: total,
                    forma_pagamento: paymentMethod
                }])
                .select()
                .single();

            if (saleError) throw saleError;

            // 2. Criar os itens da venda (SEM subtotal - é calculado automaticamente)
            const saleItems = cart.map(item => ({
                venda_id: saleData.id,
                produto_id: item.id,
                quantidade: item.quantity,
                valor_unitario: item.valor_venda
            }));

            const { error: itemsError } = await supabase
                .from('itens_venda')
                .insert(saleItems);

            if (itemsError) throw itemsError;

            // 3. SEMPRE criar parcelas para rastreabilidade no crediário
            const dataVenda = new Date();

            if (paymentMethod === 'FIADO' && installments > 1) {
                // Venda parcelada - múltiplas parcelas não pagas
                const parcelas = [];

                // Se houver entrada, criar parcela paga (número 0)
                if (downPayment > 0) {
                    parcelas.push({
                        venda_id: saleData.id,
                        numero_parcela: 0,
                        valor_parcela: downPayment,
                        data_vencimento: dataVenda.toISOString().split('T')[0],
                        data_pagamento: dataVenda.toISOString(),
                        pago: true,
                        observacoes: 'Entrada'
                    });
                }

                // Criar parcelas do saldo restante
                const saldoParcelar = total - downPayment;
                const valorParcela = saldoParcelar / installments;

                for (let i = 1; i <= installments; i++) {
                    const dataVencimento = new Date(dataVenda);
                    dataVencimento.setMonth(dataVencimento.getMonth() + i);

                    parcelas.push({
                        venda_id: saleData.id,
                        numero_parcela: i,
                        valor_parcela: valorParcela,
                        data_vencimento: dataVencimento.toISOString().split('T')[0],
                        pago: false
                    });
                }

                const { error: parcelasError } = await supabase
                    .from('parcelas_venda')
                    .insert(parcelas);

                if (parcelasError) {
                    console.error('Erro ao criar parcelas:', parcelasError);
                    alert('⚠️ Venda criada, mas houve erro ao gerar parcelas. Verifique o crediário.');
                }
            } else {
                // Venda à vista - 1 parcela já paga para histórico e rastreabilidade
                const metodoPagamento = paymentMethod === 'CARTAO_CREDITO' ? 'Crédito' :
                    paymentMethod === 'CARTAO_DEBITO' ? 'Débito' :
                        paymentMethod === 'DINHEIRO' ? 'Dinheiro' :
                            paymentMethod;

                const { error: parcelasError } = await supabase
                    .from('parcelas_venda')
                    .insert([{
                        venda_id: saleData.id,
                        numero_parcela: 1,
                        valor_parcela: total,
                        data_vencimento: dataVenda.toISOString().split('T')[0],
                        data_pagamento: dataVenda.toISOString(),
                        pago: true,
                        observacoes: `Pagamento à vista - ${metodoPagamento}`
                    }]);

                if (parcelasError) {
                    console.error('Erro ao criar registro no crediário:', parcelasError);
                    alert('⚠️ Venda criada, mas houve erro ao registrar no crediário.');
                }
            }

            // 4. Atualizar o estoque
            for (const item of cart) {
                const { error: stockError } = await supabase
                    .from('produtos')
                    .update({
                        quantidade_estoque: item.quantidade_estoque - item.quantity
                    })
                    .eq('id', item.id);

                if (stockError) throw stockError;
            }

            alert('✅ Venda finalizada com sucesso!');

            // Limpar carrinho e recarregar produtos
            setCart([]);
            setSelectedClient('');
            setPaymentMethod('PIX');
            setInstallments(1);
            setDownPayment(0);
            fetchProducts();
        } catch (error: any) {
            console.error('Error finalizing sale:', error);
            alert('Erro ao finalizar venda: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna Principal - Produtos */}
            <div className="lg:col-span-2">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">Vendas</h2>

                {/* Barra de Busca */}
                <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar produto..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <QrCode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Código QR..."
                                    value={qrCode}
                                    onChange={(e) => setQrCode(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && searchByQRCode()}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                />
                            </div>
                            <button
                                onClick={() => setShowScanner(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                                title="Ler QR Code com câmera"
                            >
                                <Camera className="w-5 h-5" />
                                Ler QR
                            </button>
                            <button
                                onClick={searchByQRCode}
                                className="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 transition-colors"
                            >
                                Buscar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Grid de Produtos */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    {loading ? (
                        <p className="text-center text-gray-500">Carregando produtos...</p>
                    ) : filteredProducts.length === 0 ? (
                        <p className="text-center text-gray-500">Nenhum produto disponível.</p>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map((product) => (
                                <div
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:shadow-lg hover:border-pink-500 transition-all"
                                >
                                    <div className="aspect-square mb-2 bg-gray-100 rounded-md overflow-hidden">
                                        {product.image_url ? (
                                            <img
                                                src={product.image_url}
                                                alt={product.descricao}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <PackageIcon className="w-12 h-12 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-pink-600 font-semibold mb-1">
                                        {product.categoria}
                                    </div>
                                    <h3 className="text-sm font-medium text-gray-800 mb-2 line-clamp-2">
                                        {product.descricao}
                                    </h3>
                                    <div className="text-lg font-bold text-gray-900">
                                        R$ {product.valor_venda.toFixed(2)}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Est: {product.quantidade_estoque}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Coluna Lateral - Carrinho e Checkout */}
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-lg shadow-md sticky top-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-gray-800 flex items-center">
                            <ShoppingCart className="w-6 h-6 mr-2" />
                            Carrinho
                        </h3>
                        <span className="bg-pink-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                            {cart.reduce((total, item) => total + item.quantity, 0)}
                        </span>
                    </div>

                    {/* Itens do Carrinho */}
                    <div className="mb-6 max-h-64 overflow-y-auto">
                        {cart.length === 0 ? (
                            <p className="text-center text-gray-400 py-8">Carrinho vazio</p>
                        ) : (
                            cart.map((item) => (
                                <div key={item.id} className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-gray-800">{item.descricao}</h4>
                                        <p className="text-xs text-gray-500">R$ {item.valor_venda.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                                            className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                                        />
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Seleção de Cliente */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cliente</label>
                        <select
                            value={selectedClient}
                            onChange={(e) => setSelectedClient(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                        >
                            <option value="">Selecione o cliente...</option>
                            {clients.map((client) => (
                                <option key={client.id} value={client.id}>
                                    {client.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Forma de Pagamento */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Pagamento</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'FIADO'].map((method) => (
                                <button
                                    key={method}
                                    onClick={() => {
                                        setPaymentMethod(method);
                                        if (method !== 'FIADO') {
                                            setInstallments(1);
                                        }
                                    }}
                                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${paymentMethod === method
                                        ? 'bg-pink-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {method === 'CARTAO_CREDITO' ? 'Crédito' :
                                        method === 'CARTAO_DEBITO' ? 'Débito' :
                                            method === 'DINHEIRO' ? 'Dinheiro' :
                                                method === 'FIADO' ? 'Parcelado' : method}
                                </button>
                            ))}
                        </div>

                        {/* Seleção de Parcelas e Entrada */}
                        {paymentMethod === 'FIADO' && (
                            <div className="mt-4 space-y-4">
                                {/* Campo de Entrada */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Entrada (Opcional)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">R$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max={calculateTotal()}
                                            step="0.01"
                                            value={downPayment}
                                            onChange={(e) => {
                                                const value = parseFloat(e.target.value) || 0;
                                                if (value <= calculateTotal()) {
                                                    setDownPayment(value);
                                                }
                                            }}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {/* Botões Rápidos */}
                                    <div className="grid grid-cols-4 gap-2 mt-2">
                                        {[10, 20, 30, 50].map((percent) => (
                                            <button
                                                key={percent}
                                                type="button"
                                                onClick={() => setDownPayment((calculateTotal() * percent) / 100)}
                                                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                            >
                                                {percent}%
                                            </button>
                                        ))}
                                    </div>
                                    {/* Info do Saldo */}
                                    {downPayment > 0 && (
                                        <div className="mt-2 text-xs space-y-1">
                                            <div className="flex justify-between text-gray-600">
                                                <span>Entrada:</span>
                                                <span className="font-semibold text-green-600">R$ {downPayment.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-600">
                                                <span>Saldo a parcelar:</span>
                                                <span className="font-semibold text-pink-600">R$ {(calculateTotal() - downPayment).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    )}
                                    {downPayment > calculateTotal() && (
                                        <p className="text-xs text-red-600 mt-1">⚠️ Entrada não pode ser maior que o total</p>
                                    )}
                                </div>

                                {/* Seleção de Parcelas */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Parcelas do Saldo</label>
                                    <select
                                        value={installments}
                                        onChange={(e) => setInstallments(parseInt(e.target.value))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                                    >
                                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                                            const saldoParcelar = calculateTotal() - downPayment;
                                            const valorParcela = saldoParcelar / num;
                                            return (
                                                <option key={num} value={num}>
                                                    {num}x de R$ {valorParcela.toFixed(2)}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Total e Finalizar */}
                    <div className="border-t border-gray-200 pt-4">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-lg font-bold text-gray-800">Total:</span>
                            <span className="text-2xl font-bold text-pink-600">
                                R$ {calculateTotal().toFixed(2)}
                            </span>
                        </div>
                        <button
                            onClick={handleFinalizeSale}
                            disabled={cart.length === 0 || !selectedClient || processing}
                            className="w-full bg-pink-600 text-white font-bold py-3 rounded-md hover:bg-pink-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CreditCard className="w-5 h-5 mr-2" />
                            {processing ? 'Processando...' : 'Finalizar Venda'}
                        </button>
                    </div>
                </div>
            </div>

            {/* QR Scanner Modal */}
            {showScanner && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center">
                                <Camera className="w-6 h-6 mr-2 text-blue-600" />
                                Escanear QR Code
                            </h3>
                            <button
                                onClick={() => setShowScanner(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="aspect-square bg-black rounded-lg overflow-hidden">
                                <Scanner
                                    onScan={handleScan}
                                    onError={handleScanError}
                                    constraints={{
                                        facingMode: 'environment'
                                    }}
                                    styles={{
                                        container: {
                                            width: '100%',
                                            height: '100%'
                                        }
                                    }}
                                />
                            </div>
                            <p className="text-center text-sm text-gray-600 mt-4">
                                Aponte a câmera para o QR Code do produto
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sales;
