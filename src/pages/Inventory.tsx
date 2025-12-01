import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, Package as PackageIcon, Printer, Upload, Plus, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Product {
    id: string;
    codigo: string;
    descricao: string;
    categoria: string;
    valor_venda: number;
    valor_custo?: number;
    quantidade_estoque: number;
    image_url: string | null;
    conta_pagar_id?: string | null;
}

interface PurchaseOrigin {
    fornecedor: { nome: string; cpf_cnpj?: string; telefone?: string; endereco?: string };
    numero_nota_fiscal?: string;
    descricao: string;
    valor_total: number;
    forma_pagamento?: string;
    created_at: string;
}

const Inventory: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Estados para modal de rastreabilidade
    const [showOriginModal, setShowOriginModal] = useState(false);
    const [selectedOrigin, setSelectedOrigin] = useState<PurchaseOrigin | null>(null);

    const [formData, setFormData] = useState({
        descricao: '',
        categoria: '',
        valor_venda: '',
        quantidade_estoque: ''
    });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('produtos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateProductCode = () => {
        return Math.floor(10000000 + Math.random() * 90000000).toString();
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (file: File, productCode: string): Promise<string | null> => {
        try {
            console.log('🖼️ Iniciando upload da imagem...', file.name);

            const fileExt = file.name.split('.').pop();
            const fileName = `${productCode}_${Date.now()}.${fileExt}`;
            const filePath = `products/${fileName}`;

            console.log('📁 Caminho do arquivo:', filePath);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) {
                console.error('❌ Erro no upload:', uploadError);
                throw uploadError;
            }

            console.log('✅ Upload realizado com sucesso:', uploadData);

            const { data } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            console.log('🔗 URL pública gerada:', data.publicUrl);

            return data.publicUrl;
        } catch (error: any) {
            console.error('❌ Error uploading image:', error);

            if (error.message?.includes('not found')) {
                throw new Error('BUCKET_NOT_FOUND');
            }

            return null;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const startEditing = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            descricao: product.descricao,
            categoria: product.categoria || '',
            valor_venda: product.valor_venda.toString(),
            quantidade_estoque: product.quantidade_estoque.toString()
        });
        setImagePreview(product.image_url);
        setSelectedFile(null);

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEditing = () => {
        setEditingProduct(null);
        setFormData({ descricao: '', categoria: '', valor_venda: '', quantidade_estoque: '' });
        setImagePreview(null);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setUploading(true);

        try {
            const productCode = editingProduct ? editingProduct.codigo : generateProductCode();
            let imageUrl = editingProduct ? editingProduct.image_url : null;
            let imageUploadFailed = false;

            // Upload new image if selected
            if (selectedFile) {
                console.log('📸 Imagem selecionada, iniciando upload...');
                try {
                    const newImageUrl = await uploadImage(selectedFile, productCode);
                    if (newImageUrl) {
                        imageUrl = newImageUrl;
                        console.log('✅ Imagem carregada com sucesso! URL:', imageUrl);
                    } else {
                        console.warn('⚠️ Upload retornou null');
                        imageUploadFailed = true;
                    }
                } catch (uploadError: any) {
                    console.error('❌ Erro no upload da imagem:', uploadError);
                    imageUploadFailed = true;

                    if (uploadError.message === 'BUCKET_NOT_FOUND') {
                        alert('⚠️ ATENÇÃO: Bucket de imagens não configurado!');
                    }
                }
            }

            const productData = {
                descricao: formData.descricao,
                categoria: formData.categoria,
                valor_venda: parseFloat(formData.valor_venda),
                quantidade_estoque: parseInt(formData.quantidade_estoque),
                image_url: imageUrl
            };

            if (editingProduct) {
                // Update existing product
                console.log('💾 Atualizando produto...');
                const { error } = await supabase
                    .from('produtos')
                    .update(productData)
                    .eq('id', editingProduct.id);

                if (error) throw error;
                alert('✅ Produto atualizado com sucesso!');
            } else {
                // Insert new product
                console.log('💾 Salvando novo produto...');
                const { error } = await supabase
                    .from('produtos')
                    .insert([{
                        codigo: productCode,
                        ...productData
                    }]);

                if (error) throw error;

                let successMessage = '✅ Produto cadastrado com sucesso!';
                if (imageUploadFailed && selectedFile) {
                    successMessage += '\n\n⚠️ Porém, a imagem NÃO foi carregada.';
                }
                alert(successMessage);
            }

            cancelEditing(); // Resets form and state
            fetchProducts();
        } catch (error: any) {
            console.error('Error saving product:', error);
            alert('Erro ao salvar produto: ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;

        try {
            const { error } = await supabase
                .from('produtos')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchProducts();
        } catch (error: any) {
            console.error('Error deleting product:', error);
            if (error.code === '23503') {
                alert('❌ Não é possível excluir este produto pois ele já possui vendas registradas.\n\nPara manter o histórico de vendas, produtos vendidos não podem ser apagados.');
            } else {
                alert('Erro ao excluir produto: ' + (error.message || 'Erro desconhecido'));
            }
        }
    };

    const handleAddStock = async (product: Product) => {
        const quantityStr = prompt(
            `📦 Adicionar estoque ao produto:\n${product.descricao}\n\nEstoque atual: ${product.quantidade_estoque} unid.\n\nQuantidade a adicionar:`
        );

        if (!quantityStr) return;

        const quantity = parseInt(quantityStr);

        if (isNaN(quantity) || quantity <= 0) {
            alert('⚠️ Por favor, insira uma quantidade válida.');
            return;
        }

        try {
            const newStock = product.quantidade_estoque + quantity;

            const { error } = await supabase
                .from('produtos')
                .update({ quantidade_estoque: newStock })
                .eq('id', product.id);

            if (error) throw error;

            alert(`✅ Estoque atualizado!\n\nAnterior: ${product.quantidade_estoque} unid.\nAdicionado: +${quantity} unid.\nNovo total: ${newStock} unid.`);
            fetchProducts();
        } catch (error) {
            console.error('Error updating stock:', error);
            alert('Erro ao atualizar estoque.');
        }
    };

    const handlePrintQR = (productCode: string) => {
        const printWindow = window.open('', '', 'width=400,height=400');
        if (printWindow) {
            const qrElement = document.getElementById(`qr-${productCode}`);
            if (qrElement) {
                printWindow.document.write('<html><head><title>QR Code</title></head><body>');
                printWindow.document.write(qrElement.innerHTML);
                printWindow.document.write('</body></html>');
                printWindow.document.close();
                printWindow.print();
            }
        }
    };

    const fetchPurchaseOrigin = async (contaPagarId: string) => {
        try {
            const { data, error } = await supabase
                .from('contas_pagar')
                .select(`
                    *,
                    fornecedor:fornecedores(nome, cpf_cnpj, telefone, endereco)
                `)
                .eq('id', contaPagarId)
                .single();

            if (error) throw error;

            setSelectedOrigin(data);
            setShowOriginModal(true);
        } catch (error) {
            console.error('Error fetching purchase origin:', error);
            alert('Erro ao buscar origem do produto');
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Estoque</h2>

            {/* Form Section */}
            <div className={`bg-white p-6 rounded-lg shadow-md mb-8 transition-all ${editingProduct ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">
                        {editingProduct ? 'Editar Produto' : 'Cadastrar Produto'}
                    </h3>
                    {editingProduct && (
                        <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-700">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Imagem</label>
                        <div className="relative">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                                id="image-upload"
                            />
                            <label
                                htmlFor="image-upload"
                                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 overflow-hidden"
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                        <span className="text-xs text-gray-500 text-center px-2">
                                            {editingProduct ? 'Alterar foto' : 'Adicionar foto'}
                                        </span>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Produto</label>
                        <input
                            type="text"
                            name="descricao"
                            placeholder="Ex: Anel Ouro 18k"
                            value={formData.descricao}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            required
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                        <input
                            type="text"
                            name="categoria"
                            placeholder="Ex: Anéis"
                            value={formData.categoria}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Valor Venda</label>
                        <input
                            type="number"
                            step="0.01"
                            name="valor_venda"
                            placeholder="0.00"
                            value={formData.valor_venda}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            required
                        />
                    </div>

                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantidade</label>
                        <input
                            type="number"
                            name="quantidade_estoque"
                            placeholder="0"
                            value={formData.quantidade_estoque}
                            onChange={handleInputChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            required
                        />
                    </div>

                    <div className="md:col-span-6">
                        <button
                            type="submit"
                            disabled={uploading}
                            className={`text-white font-bold py-2 px-6 rounded-md transition-colors flex items-center disabled:opacity-50 ${editingProduct ? 'bg-blue-600 hover:bg-blue-700' : 'bg-pink-600 hover:bg-pink-700'}`}
                        >
                            <PackageIcon className="w-5 h-5 mr-2" />
                            {uploading ? 'Salvando...' : (editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto')}
                        </button>
                        {editingProduct && (
                            <button
                                type="button"
                                onClick={cancelEditing}
                                className="ml-4 text-gray-600 hover:text-gray-800 font-medium"
                            >
                                Cancelar
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Products List */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-600 text-sm">
                                <th className="p-4 font-medium">Imagem</th>
                                <th className="p-4 font-medium">Produto</th>
                                <th className="p-4 font-medium">QR Code</th>
                                <th className="p-4 font-medium">Preço</th>
                                <th className="p-4 font-medium">Estoque</th>
                                <th className="p-4 font-medium text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center">Carregando...</td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-4 text-center">Nenhum produto cadastrado.</td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product.id} className={`border-t border-gray-100 hover:bg-gray-50 ${editingProduct?.id === product.id ? 'bg-blue-50' : ''}`}>
                                        <td className="p-4">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.descricao}
                                                    className="w-16 h-16 object-cover rounded-md"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 bg-gray-200 rounded-md flex items-center justify-center">
                                                    <PackageIcon className="w-8 h-8 text-gray-400" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium">{product.descricao}</div>
                                            <div className="text-sm text-gray-500">
                                                {product.categoria} • {product.codigo}
                                            </div>
                                            {product.valor_custo && (
                                                <div className="text-xs text-gray-400 mt-1">
                                                    Custo: R$ {product.valor_custo.toFixed(2)}
                                                </div>
                                            )}
                                            {product.conta_pagar_id && (
                                                <button
                                                    onClick={() => fetchPurchaseOrigin(product.conta_pagar_id!)}
                                                    className="mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center"
                                                    title="Ver origem do produto (Nota Fiscal/Fornecedor)"
                                                >
                                                    📋 Ver Nota Fiscal
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center space-x-2">
                                                <div id={`qr-${product.codigo}`} className="bg-white p-2 border border-gray-200 rounded">
                                                    <QRCodeSVG value={product.codigo} size={60} />
                                                </div>
                                                <button
                                                    onClick={() => handlePrintQR(product.codigo)}
                                                    className="text-gray-400 hover:text-blue-500"
                                                    title="Imprimir QR Code"
                                                >
                                                    <Printer className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-4 font-medium">
                                            R$ {product.valor_venda.toFixed(2)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${product.quantidade_estoque > 5
                                                ? 'bg-green-100 text-green-700'
                                                : product.quantidade_estoque > 0
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : 'bg-red-100 text-red-700'
                                                }`}>
                                                {product.quantidade_estoque} unid.
                                            </span>
                                        </td>
                                        <td className="p-4 flex justify-center space-x-2">
                                            <button
                                                onClick={() => handleAddStock(product)}
                                                className="text-gray-400 hover:text-green-500"
                                                title="Adicionar estoque"
                                            >
                                                <Plus className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => startEditing(product)}
                                                className="text-gray-400 hover:text-blue-500"
                                                title="Editar produto"
                                            >
                                                <Pencil className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product.id)}
                                                className="text-gray-400 hover:text-red-500"
                                                title="Excluir produto"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Origem do Produto */}
            {showOriginModal && selectedOrigin && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-800">
                                📋 Origem do Produto - Nota Fiscal
                            </h3>
                            <button
                                onClick={() => setShowOriginModal(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Nota Fiscal */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-blue-900 mb-2">Nota Fiscal</h4>
                                <p className="text-2xl font-bold text-blue-700">
                                    {selectedOrigin.numero_nota_fiscal || 'Não informado'}
                                </p>
                            </div>

                            {/* Fornecedor */}
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-gray-900 mb-3">Fornecedor</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-sm text-gray-600">Nome:</span>
                                        <p className="font-medium text-gray-800">{selectedOrigin.fornecedor.nome}</p>
                                    </div>
                                    {selectedOrigin.fornecedor.cpf_cnpj && (
                                        <div>
                                            <span className="text-sm text-gray-600">CPF/CNPJ:</span>
                                            <p className="font-medium text-gray-800">{selectedOrigin.fornecedor.cpf_cnpj}</p>
                                        </div>
                                    )}
                                    {selectedOrigin.fornecedor.telefone && (
                                        <div>
                                            <span className="text-sm text-gray-600">Telefone:</span>
                                            <p className="font-medium text-gray-800">{selectedOrigin.fornecedor.telefone}</p>
                                        </div>
                                    )}
                                    {selectedOrigin.fornecedor.endereco && (
                                        <div className="md:col-span-2">
                                            <span className="text-sm text-gray-600">Endereço:</span>
                                            <p className="font-medium text-gray-800">{selectedOrigin.fornecedor.endereco}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Detalhes da Compra */}
                            <div className="bg-green-50 p-4 rounded-lg">
                                <h4 className="font-semibold text-green-900 mb-3">Detalhes da Compra</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-sm text-gray-600">Descrição:</span>
                                        <p className="font-medium text-gray-800">{selectedOrigin.descricao}</p>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-600">Valor Total:</span>
                                        <p className="font-medium text-green-700 text-lg">R$ {selectedOrigin.valor_total.toFixed(2)}</p>
                                    </div>
                                    {selectedOrigin.forma_pagamento && (
                                        <div>
                                            <span className="text-sm text-gray-600">Forma de Pagamento:</span>
                                            <p className="font-medium text-gray-800">{selectedOrigin.forma_pagamento.replace('_', ' ')}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-sm text-gray-600">Data da Compra:</span>
                                        <p className="font-medium text-gray-800">
                                            {new Date(selectedOrigin.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end">
                            <button
                                onClick={() => setShowOriginModal(false)}
                                className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inventory;
