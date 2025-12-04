import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ShoppingBag, Package, X, MessageCircle, Sparkles } from 'lucide-react';

interface Product {
    id: string;
    codigo: string;
    descricao: string;
    categoria: string;
    valor_venda: number;
    quantidade_estoque: number;
    image_url: string | null;
}

const Catalog: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const WHATSAPP_NUMBER = '5573999626212'; // Formato internacional sem espaços

    useEffect(() => {
        fetchProducts();
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
        } finally {
            setLoading(false);
        }
    };

    // Pegar categorias únicas
    const categories = ['TODAS', ...Array.from(new Set(products.map(p => p.categoria).filter(Boolean)))];

    // Filtrar produtos
    const filteredProducts = products.filter(product => {
        const matchesSearch = searchTerm === '' ||
            product.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.categoria?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === 'TODAS' || product.categoria === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    const handleWhatsAppClick = (product: Product) => {
        const message = `Olá! Gostaria de saber mais sobre: *${product.descricao}* (Cód: ${product.codigo})`;
        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
            {/* Header */}
            <header className="bg-white shadow-lg sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-full p-3">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                                    Rúbia Jóias e Acessórios
                                </h1>
                                <p className="text-sm text-gray-600">Elegância e Sofisticação</p>
                            </div>
                        </div>
                        <a
                            href={`https://wa.me/${WHATSAPP_NUMBER}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-medium transition-all shadow-lg hover:shadow-xl"
                        >
                            <MessageCircle className="w-5 h-5" />
                            Fale Conosco
                        </a>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {/* Search and Filters */}
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Buscar produtos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Category Filter */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${selectedCategory === category
                                            ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 text-sm text-gray-600">
                        <ShoppingBag className="w-4 h-4 inline mr-1" />
                        {filteredProducts.length} {filteredProducts.length === 1 ? 'produto disponível' : 'produtos disponíveis'}
                    </div>
                </div>

                {/* Products Grid */}
                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Carregando produtos...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Nenhum produto encontrado</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProducts.map((product) => (
                            <div
                                key={product.id}
                                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group"
                            >
                                {/* Image */}
                                <div className="relative aspect-square overflow-hidden bg-gray-100">
                                    {product.image_url ? (
                                        <img
                                            src={product.image_url}
                                            alt={product.descricao}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 cursor-pointer"
                                            onClick={() => setZoomedImage(product.image_url)}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-20 h-20 text-gray-300" />
                                        </div>
                                    )}
                                    {product.quantidade_estoque <= 3 && (
                                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                            Últimas unidades!
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <h3 className="font-bold text-gray-800 text-lg mb-1 line-clamp-2">
                                        {product.descricao}
                                    </h3>
                                    {product.categoria && (
                                        <p className="text-sm text-gray-500 mb-3">{product.categoria}</p>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                                            R$ {product.valor_venda.toFixed(2)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setSelectedProduct(product)}
                                        className="w-full mt-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white py-2 rounded-xl font-medium hover:shadow-lg transition-all"
                                    >
                                        Ver Detalhes
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Product Detail Modal */}
            {selectedProduct && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedProduct(null)}
                >
                    <div
                        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative">
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 z-10"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            {/* Image */}
                            <div className="aspect-square bg-gray-100">
                                {selectedProduct.image_url ? (
                                    <img
                                        src={selectedProduct.image_url}
                                        alt={selectedProduct.descricao}
                                        className="w-full h-full object-cover cursor-pointer"
                                        onClick={() => setZoomedImage(selectedProduct.image_url)}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Package className="w-32 h-32 text-gray-300" />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-6">
                                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                                    {selectedProduct.descricao}
                                </h2>
                                {selectedProduct.categoria && (
                                    <p className="text-gray-500 mb-4">{selectedProduct.categoria}</p>
                                )}
                                <div className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-6">
                                    R$ {selectedProduct.valor_venda.toFixed(2)}
                                </div>

                                {selectedProduct.quantidade_estoque <= 3 && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                                        <p className="text-red-700 text-sm font-medium">
                                            ⚠️ Apenas {selectedProduct.quantidade_estoque} {selectedProduct.quantidade_estoque === 1 ? 'unidade disponível' : 'unidades disponíveis'}!
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => handleWhatsAppClick(selectedProduct)}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                                >
                                    <MessageCircle className="w-6 h-6" />
                                    Consultar Disponibilidade
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Zoom Modal */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4"
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-4 right-4 text-white bg-black bg-opacity-50 hover:bg-opacity-75 rounded-full p-2"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img
                        src={zoomedImage}
                        alt="Imagem ampliada"
                        className="max-w-full max-h-full object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Floating WhatsApp Button (Mobile) */}
            <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="md:hidden fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl z-40 transition-all hover:scale-110"
            >
                <MessageCircle className="w-6 h-6" />
            </a>
        </div>
    );
};

export default Catalog;
