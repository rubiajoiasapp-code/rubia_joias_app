import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, DollarSign, Package, Users, CreditCard, LogOut, Menu, X, Settings, CalendarClock, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Menu na ordem em que o trabalho acontece, não em ordem alfabética nem de cadastro:
// abre o dia no Dashboard, vende, acompanha o que a venda gerou de parcela, cobra o que
// vence. Cadastro e retaguarda vêm depois porque são visitados poucas vezes por semana.
// Os títulos de grupo existem para que a ordem seja visível — uma lista corrida de nove
// itens não comunica sequência nenhuma.
const navGroups = [
    {
        titulo: null,
        itens: [
            { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        titulo: 'Dia a dia',
        itens: [
            { path: '/vendas', label: 'Vendas', icon: ShoppingCart },
            { path: '/crediario', label: 'Crediário', icon: CreditCard },
            { path: '/vencimentos', label: 'Vencimentos', icon: CalendarClock },
        ],
    },
    {
        titulo: 'Cadastros',
        itens: [
            { path: '/clientes', label: 'Clientes', icon: Users },
            { path: '/estoque', label: 'Estoque', icon: Package },
        ],
    },
    {
        titulo: 'Retaguarda',
        itens: [
            { path: '/financeiro', label: 'Financeiro', icon: DollarSign },
            { path: '/historico', label: 'Histórico', icon: History },
        ],
    },
    {
        titulo: null,
        itens: [
            { path: '/configuracoes', label: 'Configurações', icon: Settings },
        ],
    },
];

const Layout: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-pink-600 text-white rounded-lg shadow-lg"
                aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={closeMobileMenu}
                />
            )}

            {/* Sidebar. Coluna flex em vez do "Sair" posicionado em absolute: com os
                grupos o menu ficou mais alto, e em tela baixa o botão passava por cima
                dos últimos itens. Agora a lista rola e o Sair fica ancorado embaixo. */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-40
                w-64 bg-white shadow-md flex flex-col transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* pl-16 no mobile: o botão de menu é fixed em left-4 e passaria por cima
                    da logo. No desktop o botão não existe e a margem volta ao normal. */}
                <div className="flex items-center gap-3 pl-16 lg:pl-6 pr-6 py-5 shrink-0">
                    {/* Placa preta porque o símbolo é dourado: ouro sobre branco quase
                        some. Mesmo tratamento usado no cabeçalho do recibo. */}
                    <img
                        src="/logo-simbolo.png"
                        alt=""
                        className="w-11 h-11 shrink-0 object-contain bg-black rounded-lg p-1"
                    />
                    <h1 className="text-xl font-bold text-pink-600 leading-tight">
                        Rúbia Jóias
                    </h1>
                </div>

                <nav className="flex-1 overflow-y-auto pb-4">
                    {navGroups.map((grupo, i) => (
                        <div key={grupo.titulo ?? `grupo-${i}`} className="mt-2 first:mt-0">
                            {grupo.titulo && (
                                <p className="px-6 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                    {grupo.titulo}
                                </p>
                            )}
                            {grupo.itens.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        onClick={closeMobileMenu}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={`flex items-center px-6 py-3 transition-colors ${isActive
                                            ? 'bg-pink-600 text-white'
                                            : 'text-gray-700 hover:bg-pink-50 hover:text-pink-600'
                                            }`}
                                    >
                                        <Icon className="w-5 h-5 mr-3 shrink-0" />
                                        <span className="font-medium">{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                <div className="shrink-0 p-4 border-t border-gray-100">
                    <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-6 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors rounded-lg"
                    >
                        <LogOut className="w-5 h-5 mr-3" />
                        <span className="font-medium">Sair</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pt-16 lg:pt-8">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
