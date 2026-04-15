import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, Package as PackageIcon, Printer, Upload, Plus, X, Search, CheckSquare, Eye, EyeOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cacheGet, cacheSet, cacheInvalidate } from '../lib/cache';
import { formatCurrency } from '../lib/format';
import { notify } from '../lib/notify';

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
    show_in_catalog?: boolean;
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
    const initialCachedProducts = cacheGet<Product[]>('inventory_products');
    const [products, setProducts] = useState<Product[]>(initialCachedProducts || []);
    const [loading, setLoading] = useState(!initialCachedProducts);
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

    // Estados para busca e filtro
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTab, setFilterTab] = useState<'TODOS' | 'COM_ESTOQUE' | 'SEM_ESTOQUE'>('TODOS');

    // Estado para zoom de imagem
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Estado para seleção de produtos
    const [selectedProds, setSelectedProds] = useState<Set<string>>(new Set());
    const [processingBulk, setProcessingBulk] = useState(false);
    const [showTopContributors, setShowTopContributors] = useState(false);
    const [outlierModal, setOutlierModal] = useState<{
        reasons: string[];
        snapshot: { descricao: string; categoria: string; valorVenda: number; qtd: number };
    } | null>(null);
    const [outlierConfirmText, setOutlierConfirmText] = useState('');

    useEffect(() => {
        fetchProducts();
    }, []);

    // Fechar modal de zoom com ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && zoomedImage) {
                setZoomedImage(null);
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [zoomedImage]);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('produtos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProducts(data || []);
            cacheSet('inventory_products', data || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateProductCode = () => {
        return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    };

    const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            notify.warning('Arquivo inválido', { description: 'Selecione uma imagem (JPG, PNG, WebP).' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            notify.warning('Imagem muito grande', { description: 'Tamanho máximo: 5 MB.' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
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

    const computeOutlierReasons = (
        descricao: string,
        categoria: string,
        valorVenda: number,
        qtd: number,
    ): string[] => {
        const reasons: string[] = [];
        const others = products.filter(p => !editingProduct || p.id !== editingProduct.id);

        const categoriaKey = categoria.trim().toLowerCase();
        const sameCat = others.filter(
            p => p.categoria.trim().toLowerCase() === categoriaKey && p.valor_venda > 0,
        );
        const globalWithPrice = others.filter(p => p.valor_venda > 0);

        const median = (arr: number[]): number => {
            if (!arr.length) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        };

        if (valorVenda > 0) {
            const pool = sameCat.length >= 3 ? sameCat : globalWithPrice;
            const medianaValor = median(pool.map(p => p.valor_venda));
            const poolLabel = sameCat.length >= 3 ? `categoria "${categoria}"` : 'todos os produtos';
            if (medianaValor > 0) {
                if (valorVenda > medianaValor * 3) {
                    reasons.push(
                        `💰 Preço ACIMA do padrão — ${formatCurrency(valorVenda)} é ${(valorVenda / medianaValor).toFixed(1)}× a mediana (${formatCurrency(medianaValor)}) de ${poolLabel}.`,
                    );
                } else if (valorVenda < medianaValor / 3) {
                    reasons.push(
                        `💰 Preço ABAIXO do padrão — ${formatCurrency(valorVenda)} é ${(medianaValor / valorVenda).toFixed(1)}× menor que a mediana (${formatCurrency(medianaValor)}) de ${poolLabel}.`,
                    );
                }
            }
        }

        if (qtd > 10) {
            const globalQtds = others.filter(p => p.quantidade_estoque > 0).map(p => p.quantidade_estoque);
            const medianaQtd = median(globalQtds);
            if (medianaQtd > 0 && qtd > medianaQtd * 5) {
                reasons.push(
                    `📦 Quantidade ACIMA do padrão — ${qtd} unidades é ${(qtd / medianaQtd).toFixed(1)}× a mediana (${medianaQtd} unid.) do estoque.`,
                );
            }
        }

        void descricao;
        return reasons;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (uploading) return;

        // Validação
        const descricao = formData.descricao.trim();
        if (!descricao) {
            notify.warning('Informe o nome do produto.');
            return;
        }
        const valorVenda = parseFloat(formData.valor_venda);
        if (!Number.isFinite(valorVenda) || valorVenda < 0) {
            notify.warning('Valor de venda inválido.');
            return;
        }
        const qtd = parseInt(formData.quantidade_estoque, 10);
        if (!Number.isFinite(qtd) || qtd < 0) {
            notify.warning('Quantidade em estoque inválida', { description: 'Não pode ser negativa.' });
            return;
        }

        const reasons = computeOutlierReasons(descricao, formData.categoria, valorVenda, qtd);
        if (reasons.length > 0) {
            setOutlierModal({
                reasons,
                snapshot: { descricao, categoria: formData.categoria.trim(), valorVenda, qtd },
            });
            setOutlierConfirmText('');
            return;
        }

        await performSave(descricao, formData.categoria.trim(), valorVenda, qtd);
    };

    const performSave = async (
        descricao: string,
        categoria: string,
        valorVenda: number,
        qtd: number,
    ) => {
        if (uploading) return;
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
                        notify.warning('Bucket de imagens não configurado', { description: 'Configure no Supabase Storage para habilitar uploads.' });
                    }
                }
            }

            const productData = {
                descricao: descricao,
                categoria: categoria,
                valor_venda: valorVenda,
                quantidade_estoque: qtd,
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
                notify.success('Produto atualizado com sucesso!');
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

                if (imageUploadFailed && selectedFile) {
                    notify.success('Produto cadastrado', { description: 'A imagem NÃO foi carregada — verifique o bucket de Storage.' });
                } else {
                    notify.success('Produto cadastrado com sucesso!');
                }
            }

            cancelEditing(); // Resets form and state
            cacheInvalidate('inventory_products');
            fetchProducts();
        } catch (error: any) {
            console.error('Error saving product:', error);
            notify.error('Erro ao salvar produto', { description: error.message });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const ok = await notify.confirm({
            title: 'Excluir produto?',
            description: 'Essa ação não pode ser desfeita.',
            confirmText: 'Excluir',
            tone: 'danger',
        });
        if (!ok) return;

        try {
            const { error } = await supabase
                .from('produtos')
                .delete()
                .eq('id', id);

            if (error) throw error;
            cacheInvalidate('inventory_products');
            fetchProducts();
        } catch (error: any) {
            console.error('Error deleting product:', error);
            if (error.code === '23503') {
                notify.error('Não é possível excluir este produto', { description: 'Ele já possui vendas registradas. Produtos vendidos não podem ser apagados para manter o histórico.' });
            } else {
                notify.error('Erro ao excluir produto', { description: error.message || 'Erro desconhecido' });
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
            notify.warning('Quantidade inválida', { description: 'Informe um número maior que zero.' });
            return;
        }

        try {
            const newStock = product.quantidade_estoque + quantity;

            const { error } = await supabase
                .from('produtos')
                .update({ quantidade_estoque: newStock })
                .eq('id', product.id);

            if (error) throw error;

            notify.success('Estoque atualizado', { description: `${product.quantidade_estoque} → ${newStock} unid. (+${quantity})` });
            cacheInvalidate('inventory_products');
            fetchProducts();
        } catch (error) {
            console.error('Error updating stock:', error);
            notify.error('Erro ao atualizar estoque.');
        }
    };

    const handlePrintQR = (productCode: string) => {
        const qrElement = document.getElementById(`qr-${productCode}`);
        if (!qrElement) {
            notify.error('QR Code não encontrado', { description: 'Tente novamente.' });
            return;
        }
        const printWindow = window.open('', '', 'width=400,height=400');
        if (!printWindow) {
            notify.warning('Pop-up bloqueado', { description: 'Permita pop-ups para imprimir o QR Code.' });
            return;
        }
        printWindow.document.write('<html><head><title>QR Code</title></head><body>');
        printWindow.document.write(qrElement.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.onafterprint = () => printWindow.close();
        printWindow.print();
    };

    const closeOriginModal = () => {
        setShowOriginModal(false);
        setSelectedOrigin(null);
    };

    const fetchPurchaseOrigin = async (contaPagarId: string) => {
        try {
            // Reseta antes de buscar para evitar mostrar dados do produto anterior
            setSelectedOrigin(null);

            const { data, error } = await supabase
                .from('contas_pagar')
                .select(`
                    *,
                    fornecedor:fornecedores(nome, cpf_cnpj, telefone, endereco)
                `)
                .eq('id', contaPagarId)
                .maybeSingle();

            if (error) throw error;
            if (!data) {
                notify.warning('Origem não encontrada', { description: 'O registro pode ter sido removido.' });
                return;
            }

            setSelectedOrigin(data);
            setShowOriginModal(true);
        } catch (error) {
            console.error('Error fetching purchase origin:', error);
            notify.error('Erro ao buscar origem do produto');
        }
    };

    // Filtrar produtos baseado na busca e aba
    const filteredProducts = products
        .filter(product => {
            // Filtro de busca
            const matchesSearch = searchTerm === '' ||
                product.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.categoria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.codigo.toLowerCase().includes(searchTerm.toLowerCase());

            // Filtro de aba
            let matchesTab = true;
            if (filterTab === 'COM_ESTOQUE') {
                matchesTab = product.quantidade_estoque > 0;
            } else if (filterTab === 'SEM_ESTOQUE') {
                matchesTab = product.quantidade_estoque === 0;
            }

            return matchesSearch && matchesTab;
        })
        .sort((a, b) => {
            const aZero = a.quantidade_estoque === 0;
            const bZero = b.quantidade_estoque === 0;
            if (aZero !== bZero) return aZero ? 1 : -1;
            return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR');
        });

    // Handlers para seleção
    const toggleSelect = (id: string) => {
        const newSelected = new Set(selectedProds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedProds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedProds.size === filteredProducts.length && filteredProducts.length > 0) {
            setSelectedProds(new Set());
        } else {
            setSelectedProds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const handleBulkCatalogUpdate = async (show: boolean) => {
        if (selectedProds.size === 0) return;
        const action = show ? 'mostrar no catálogo' : 'ocultar do catálogo';
        const ok = await notify.confirm({
            title: `Confirmar ação em lote?`,
            description: `${action} ${selectedProds.size} produto(s) selecionado(s).`,
            confirmText: 'Confirmar',
        });
        if (!ok) return;
        setProcessingBulk(true);

        try {
            const { error } = await supabase
                .from('produtos')
                .update({ show_in_catalog: show })
                .in('id', Array.from(selectedProds));

            if (error) throw error;

            notify.success(`${selectedProds.size} produtos atualizados`, { description: show ? 'Adicionados ao catálogo.' : 'Removidos do catálogo.' });
            setSelectedProds(new Set()); // Clear selection
            cacheInvalidate('inventory_products');
            fetchProducts();
        } catch (error: any) {
            console.error('Error updating catalog status:', error);
            notify.error('Erro ao atualizar catálogo', { description: error.message });
        } finally {
            setProcessingBulk(false);
        }
    };

    const totalStockValue = products.reduce((total, p) => total + (p.valor_venda * p.quantidade_estoque), 0);
    const totalUnits = products.reduce((total, p) => total + p.quantidade_estoque, 0);
    const topContributors = [...products]
        .map(p => ({ produto: p, stockValue: p.valor_venda * p.quantidade_estoque }))
        .filter(x => x.stockValue > 0)
        .sort((a, b) => b.stockValue - a.stockValue)
        .slice(0, 10);

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Estoque</h2>

            {/* Valor Total em Estoque */}
            <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg shadow-lg p-6 mb-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-pink-100 mb-1">💎 Valor Total em Estoque</p>
                        <p className="text-4xl font-bold tracking-tight">
                            {formatCurrency(totalStockValue)}
                        </p>
                        <p className="text-xs text-pink-100 mt-2">
                            {totalUnits} unidades • {products.length} produtos cadastrados
                        </p>
                        {topContributors.length > 0 && (
                            <button
                                onClick={() => setShowTopContributors(v => !v)}
                                className="mt-3 text-xs font-medium text-white bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1.5 rounded-md transition-colors"
                            >
                                {showTopContributors ? '▴ Ocultar top 10' : '▾ Ver top 10 contribuintes'}
                            </button>
                        )}
                    </div>
                    <div className="hidden md:block">
                        <div className="bg-white bg-opacity-20 rounded-full p-4">
                            <PackageIcon className="w-12 h-12 text-white" />
                        </div>
                    </div>
                </div>
                {showTopContributors && topContributors.length > 0 && (
                    <div className="mt-4 bg-white bg-opacity-10 rounded-lg p-4 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-white">Top 10 produtos por valor em estoque</p>
                            <button
                                onClick={() => setShowTopContributors(false)}
                                className="text-pink-100 hover:text-white"
                                aria-label="Ocultar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {topContributors.map((item, idx) => {
                                const pct = totalStockValue > 0 ? (item.stockValue / totalStockValue) * 100 : 0;
                                return (
                                    <div key={item.produto.id} className="flex items-center gap-3 text-xs bg-white bg-opacity-5 rounded px-3 py-2">
                                        <span className="font-bold text-pink-100 w-6">{idx + 1}.</span>
                                        <span className="flex-1 truncate font-medium">{item.produto.descricao}</span>
                                        <span className="text-pink-100 whitespace-nowrap">
                                            {item.produto.quantidade_estoque} × {formatCurrency(item.produto.valor_venda)}
                                        </span>
                                        <span className="font-semibold whitespace-nowrap w-28 text-right">{formatCurrency(item.stockValue)}</span>
                                        <span className="text-pink-100 w-12 text-right">{pct.toFixed(1)}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Actions Bar */}
            {selectedProds.size > 0 && (
                <div className="bg-blue-600 text-white p-4 rounded-lg shadow-md mb-6 flex flex-wrap items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-4">
                        <span className="font-bold flex items-center gap-2">
                            <CheckSquare className="w-5 h-5" />
                            {selectedProds.size} selecionado(s)
                        </span>
                        <div className="h-6 w-px bg-blue-400"></div>
                        <span className="text-sm text-blue-100">
                            Ações em massa:
                        </span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleBulkCatalogUpdate(true)}
                            disabled={processingBulk}
                            className="bg-white text-blue-600 px-4 py-2 rounded-md font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                        >
                            <Eye className="w-4 h-4" />
                            Mostrar no Catálogo
                        </button>
                        <button
                            onClick={() => handleBulkCatalogUpdate(false)}
                            disabled={processingBulk}
                            className="bg-blue-800 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-900 transition-colors flex items-center gap-2"
                        >
                            <EyeOff className="w-4 h-4" />
                            Ocultar do Catálogo
                        </button>
                        <button
                            onClick={() => setSelectedProds(new Set())}
                            className="text-white hover:text-blue-200 p-2"
                            title="Desmarcar todos"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Busca e Filtros */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    {/* Campo de Busca */}
                    <div className="flex-1 w-full">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Buscar por produto, categoria ou código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                    </div>

                    {/* Abas de Filtro */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilterTab('TODOS')}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${filterTab === 'TODOS'
                                ? 'bg-pink-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Todos ({products.length})
                        </button>
                        <button
                            onClick={() => setFilterTab('COM_ESTOQUE')}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${filterTab === 'COM_ESTOQUE'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Com Estoque ({products.filter(p => p.quantidade_estoque > 0).length})
                        </button>
                        <button
                            onClick={() => setFilterTab('SEM_ESTOQUE')}
                            className={`px-4 py-2 rounded-md font-medium transition-colors ${filterTab === 'SEM_ESTOQUE'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Sem Estoque ({products.filter(p => p.quantidade_estoque === 0).length})
                        </button>
                    </div>
                </div>
            </div>

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
                            min="0"
                            step="1"
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
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={filteredProducts.length > 0 && selectedProds.size === filteredProducts.length}
                                        onChange={toggleSelectAll}
                                        className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 h-4 w-4"
                                    />
                                </th>
                                <th className="p-4 font-medium">Imagem</th>
                                <th className="p-4 font-medium">Produto</th>
                                <th className="p-4 font-medium">QR Code</th>
                                <th className="p-4 font-medium">Preço</th>
                                <th className="p-4 font-medium">Estoque</th>
                                <th className="p-4 font-medium text-center">Catálogo</th>
                                <th className="p-4 font-medium text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="p-4 text-center">Carregando...</td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-4 text-center text-gray-500">
                                        {products.length === 0 ? 'Nenhum produto cadastrado.' : 'Nenhum produto encontrado com os filtros selecionados.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product.id} className={`border-t border-gray-100 hover:bg-gray-50 ${editingProduct?.id === product.id ? 'bg-blue-50' : ''}`}>
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedProds.has(product.id)}
                                                onChange={() => toggleSelect(product.id)}
                                                className="rounded border-gray-300 text-pink-600 focus:ring-pink-500 h-4 w-4"
                                            />
                                        </td>
                                        <td className="p-4">
                                            {product.image_url ? (
                                                <img
                                                    src={product.image_url}
                                                    alt={product.descricao}
                                                    loading="lazy"
                                                    className="w-16 h-16 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => setZoomedImage(product.image_url)}
                                                    title="Clique para ampliar"
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
                                                    Custo: {formatCurrency(product.valor_custo)}
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
                                            {formatCurrency(product.valor_venda)}
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
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                {product.show_in_catalog ? (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        <Eye className="w-3 h-3 mr-1" />
                                                        Visível
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        <EyeOff className="w-3 h-3 mr-1" />
                                                        Oculto
                                                    </span>
                                                )}
                                            </div>
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
            {
                showOriginModal && selectedOrigin && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-800">
                                    📋 Origem do Produto - Nota Fiscal
                                </h3>
                                <button
                                    onClick={closeOriginModal}
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
                                            <p className="font-medium text-green-700 text-lg">{formatCurrency(selectedOrigin.valor_total)}</p>
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
                                    onClick={closeOriginModal}
                                    className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Confirmação de Outlier */}
            {outlierModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
                        <div className="bg-gradient-to-r from-amber-500 to-red-500 px-6 py-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                ⚠️ Valor fora do padrão
                            </h3>
                            <p className="text-amber-50 text-sm mt-1">
                                Algo no cadastro de <strong>{outlierModal.snapshot.descricao || 'produto'}</strong> parece fora da rotina.
                            </p>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-gray-700 mb-3 font-medium">
                                Detectamos o seguinte:
                            </p>
                            <ul className="space-y-2 mb-4">
                                {outlierModal.reasons.map((r, i) => (
                                    <li key={i} className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded text-sm text-gray-800">
                                        {r}
                                    </li>
                                ))}
                            </ul>
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-xs text-gray-600 space-y-1">
                                <div><strong>Produto:</strong> {outlierModal.snapshot.descricao}</div>
                                <div><strong>Categoria:</strong> {outlierModal.snapshot.categoria || '—'}</div>
                                <div><strong>Valor:</strong> {formatCurrency(outlierModal.snapshot.valorVenda)}</div>
                                <div><strong>Quantidade:</strong> {outlierModal.snapshot.qtd} unid.</div>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">
                                Se tem certeza que está certo, digite <strong className="text-red-600">Confirmo</strong> abaixo e clique em Confirmar:
                            </p>
                            <input
                                type="text"
                                value={outlierConfirmText}
                                onChange={(e) => setOutlierConfirmText(e.target.value)}
                                placeholder='Digite "Confirmo"'
                                autoFocus
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:outline-none"
                            />
                        </div>
                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setOutlierModal(null);
                                    setOutlierConfirmText('');
                                }}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => {
                                    if (outlierConfirmText.trim().toLowerCase() !== 'confirmo') return;
                                    const snap = outlierModal.snapshot;
                                    setOutlierModal(null);
                                    setOutlierConfirmText('');
                                    await performSave(snap.descricao, snap.categoria, snap.valorVenda, snap.qtd);
                                }}
                                disabled={outlierConfirmText.trim().toLowerCase() !== 'confirmo'}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-red-500 text-white rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:from-amber-600 hover:to-red-600 transition-all"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Zoom de Imagem */}
            {
                zoomedImage && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
                        onClick={() => setZoomedImage(null)}
                    >
                        <div className="relative max-w-6xl max-h-[90vh] w-full h-full flex items-center justify-center">
                            <button
                                onClick={() => setZoomedImage(null)}
                                className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2 transition-all"
                                title="Fechar (ESC)"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <img
                                src={zoomedImage}
                                alt="Imagem ampliada"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Inventory;
