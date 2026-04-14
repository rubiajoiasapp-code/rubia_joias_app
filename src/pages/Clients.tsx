import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { normalizeCpf, normalizePhone, isValidCpf, formatCpf, formatPhone } from '../lib/format';

interface Client {
    id: string;
    nome: string;
    cpf: string;
    endereco: string;
    telefone: string;
}

const emptyForm = { nome: '', cpf: '', endereco: '', telefone: '' };

const Clients: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const submittingRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        fetchClients();
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const fetchClients = async () => {
        try {
            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (mountedRef.current) setClients(data || []);
        } catch (error) {
            console.error('Error fetching clients:', error);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData(emptyForm);
        setEditingId(null);
    };

    const handleEdit = (client: Client) => {
        setEditingId(client.id);
        setFormData({
            nome: client.nome || '',
            cpf: client.cpf || '',
            endereco: client.endereco || '',
            telefone: client.telefone || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submittingRef.current) return;

        // Validação
        const nome = formData.nome.trim();
        if (!nome) {
            alert('Informe o nome do cliente.');
            return;
        }

        const cpfRaw = formData.cpf.trim();
        const cpfNormalizado = cpfRaw ? normalizeCpf(cpfRaw) : '';
        if (cpfNormalizado && !isValidCpf(cpfNormalizado)) {
            const continuar = confirm(
                'O CPF informado parece inválido (dígitos verificadores não batem). Deseja salvar mesmo assim?'
            );
            if (!continuar) return;
        }

        const telefoneNormalizado = formData.telefone ? normalizePhone(formData.telefone) : '';

        const payload = {
            nome,
            cpf: cpfNormalizado || null,
            endereco: formData.endereco.trim() || null,
            telefone: telefoneNormalizado || null
        };

        submittingRef.current = true;
        setSubmitting(true);

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('clientes')
                    .update(payload)
                    .eq('id', editingId);

                if (error) throw error;
                alert('✅ Cliente atualizado com sucesso!');
            } else {
                const { error } = await supabase
                    .from('clientes')
                    .insert([payload])
                    .select();

                if (error) throw error;
                alert('✅ Cliente cadastrado com sucesso!');
            }
            resetForm();
            fetchClients();
        } catch (error) {
            console.error('❌ Error saving client:', error);
            const err = error as { code?: string; message?: string };
            let errorMessage = editingId ? 'Erro ao atualizar cliente.' : 'Erro ao cadastrar cliente.';
            if (err.code === '23505') {
                errorMessage = '⚠️ Este CPF já está cadastrado em outro cliente!';
            } else if (err.message?.includes('Failed to fetch')) {
                errorMessage = '❌ Erro de conexão com o banco de dados. Verifique sua conexão e as credenciais.';
            } else if (err.message) {
                errorMessage += '\n\nDetalhes: ' + err.message;
            }
            alert(errorMessage);
        } finally {
            submittingRef.current = false;
            if (mountedRef.current) setSubmitting(false);
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
            const err = error as { code?: string; message?: string };
            if (err.code === '23503') {
                alert('❌ Não é possível excluir: este cliente possui vendas registradas.');
            } else {
                alert('Erro ao excluir cliente: ' + (err?.message || 'erro desconhecido'));
            }
        }
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Clientes</h2>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className={`bg-white p-6 rounded-lg shadow-md h-fit ${editingId ? 'ring-2 ring-blue-500' : ''}`}>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800">
                            {editingId ? 'Editar Cliente' : 'Novo Cliente'}
                        </h3>
                        {editingId && (
                            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
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
                                placeholder="CPF (ex: 111.222.333-44)"
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
                                placeholder="Telefone (ex: (11) 99999-9999)"
                                value={formData.telefone}
                                onChange={handleInputChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`w-full text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-pink-600 hover:bg-pink-700'}`}
                        >
                            <UserPlus className="w-5 h-5 mr-2" />
                            {submitting ? 'Salvando...' : (editingId ? 'Salvar Alterações' : 'Cadastrar')}
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
                                        <tr key={client.id} className={`border-t border-gray-100 hover:bg-gray-50 ${editingId === client.id ? 'bg-blue-50' : ''}`}>
                                            <td className="p-4 font-medium">{client.nome}</td>
                                            <td className="p-4">{formatPhone(client.telefone || '')}</td>
                                            <td className="p-4">{formatCpf(client.cpf || '')}</td>
                                            <td className="p-4">{client.endereco}</td>
                                            <td className="p-4 flex justify-center space-x-2">
                                                <button
                                                    onClick={() => handleEdit(client)}
                                                    className="text-gray-400 hover:text-blue-500"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(client.id)}
                                                    className="text-gray-400 hover:text-red-500"
                                                    title="Excluir"
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
