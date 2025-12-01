import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, UserPlus } from 'lucide-react';

interface Client {
    id: string;
    nome: string;
    cpf: string;
    endereco: string;
    telefone: string;
}

const Clients: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        nome: '',
        cpf: '',
        endereco: '',
        telefone: ''
    });

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            console.log('📝 Tentando cadastrar cliente...', formData);

            const { data, error } = await supabase
                .from('clientes')
                .insert([formData])
                .select();

            if (error) {
                console.error('❌ Erro do Supabase:', error);
                throw error;
            }

            console.log('✅ Cliente cadastrado com sucesso!', data);
            alert('✅ Cliente cadastrado com sucesso!');
            setFormData({ nome: '', cpf: '', endereco: '', telefone: '' });
            fetchClients();
        } catch (error: any) {
            console.error('❌ Error adding client:', error);

            // Mensagem de erro mais específica
            let errorMessage = 'Erro ao cadastrar cliente.';

            if (error.message) {
                errorMessage += '\n\nDetalhes: ' + error.message;
            }

            if (error.message?.includes('Failed to fetch')) {
                errorMessage = '❌ Erro de conexão com o banco de dados!\n\n' +
                    'Verifique:\n' +
                    '1. Se as credenciais no arquivo .env estão corretas\n' +
                    '2. Se o projeto Supabase está ativo\n' +
                    '3. Se há conexão com a internet\n\n' +
                    'Erro: ' + error.message;
            } else if (error.code === '23505') {
                errorMessage = '⚠️ Este CPF já está cadastrado!';
            }

            alert(errorMessage);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este cliente?')) return;

        try {
            const { error } = await supabase
                .from('clientes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchClients();
        } catch (error) {
            console.error('Error deleting client:', error);
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Clientes</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="bg-white p-6 rounded-lg shadow-md h-fit">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">Novo Cliente</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <input
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
                                placeholder="CPF"
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
                                placeholder="Telefone"
                                value={formData.telefone}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-pink-600 text-white font-bold py-2 px-4 rounded-md hover:bg-pink-700 transition-colors flex items-center justify-center"
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            Cadastrar
                        </button>
                    </form>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 text-gray-600 text-sm">
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
                                        <td colSpan={5} className="p-4 text-center">Carregando...</td>
                                    </tr>
                                ) : clients.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-4 text-center">Nenhum cliente cadastrado.</td>
                                    </tr>
                                ) : (
                                    clients.map((client) => (
                                        <tr key={client.id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="p-4 font-medium">{client.nome}</td>
                                            <td className="p-4">{client.telefone}</td>
                                            <td className="p-4">{client.cpf}</td>
                                            <td className="p-4">{client.endereco}</td>
                                            <td className="p-4 flex justify-center space-x-2">
                                                <button className="text-gray-400 hover:text-blue-500">
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(client.id)}
                                                    className="text-gray-400 hover:text-red-500"
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
            </div>
        </div>
    );
};

export default Clients;
