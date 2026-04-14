import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight } from 'lucide-react';

const translateAuthError = (msg?: string): string => {
    if (!msg) return 'Erro desconhecido';
    const m = msg.toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Email ou senha incorretos';
    if (m.includes('user already registered') || m.includes('already registered')) return 'Este email já está cadastrado';
    if (m.includes('email rate limit')) return 'Muitas tentativas. Tente novamente em alguns minutos.';
    if (m.includes('password') && m.includes('short')) return 'A senha é muito curta (mínimo 6 caracteres)';
    if (m.includes('email not confirmed')) return 'Confirme seu email antes de fazer login';
    if (m.includes('failed to fetch')) return 'Erro de conexão. Verifique sua internet.';
    return msg;
};

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { signIn, signUp, resetPassword } = useAuth();

    const initialMode: 'login' | 'signup' | 'forgot' | 'reset' =
        typeof window !== 'undefined' && window.location.pathname === '/reset-password'
            ? 'reset'
            : 'login';
    const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    // Limpa mensagem e campo de senha ao trocar de modo.
    useEffect(() => {
        setMessage('');
        setPassword('');
    }, [mode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            if (mode === 'login') {
                const { error } = await signIn(email, password, rememberMe);
                if (error) {
                    setMessage(translateAuthError(error.message));
                } else {
                    navigate('/');
                }
            } else if (mode === 'signup') {
                const { error } = await signUp(email, password, name);
                if (error) {
                    setMessage('Erro ao criar conta: ' + translateAuthError(error.message));
                } else {
                    setMessage('✅ Conta criada! Verifique seu email.');
                    setTimeout(() => setMode('login'), 2000);
                }
            } else if (mode === 'forgot') {
                const { error } = await resetPassword(email);
                if (error) {
                    setMessage('Erro ao enviar email: ' + translateAuthError(error.message));
                } else {
                    setMessage('✅ Link de recuperação enviado para seu email!');
                }
            } else if (mode === 'reset') {
                // Placeholder: o link do email inclui um token na URL que o Supabase
                // processa automaticamente. Aqui só confirmamos que o fluxo existe.
                setMessage('Acesse o link enviado para seu email para redefinir a senha.');
            }
        } catch (error: any) {
            setMessage('Erro: ' + translateAuthError(error.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-yellow-600/20 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-yellow-600/20 to-transparent rounded-full blur-3xl"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="text-center mb-8 animate-fade-in">
                    <img
                        src="/logo.png"
                        alt="Rúbia Joias"
                        className="w-48 h-48 mx-auto mb-4 drop-shadow-2xl"
                    />
                </div>

                {/* Card */}
                <div className="bg-gradient-to-b from-gray-900 to-black border border-yellow-600/30 rounded-2xl shadow-2xl p-8 backdrop-blur-sm">
                    {/* Title */}
                    <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                        {mode === 'login' && 'Bem-vindo'}
                        {mode === 'signup' && 'Criar Conta'}
                        {mode === 'forgot' && 'Recuperar Senha'}
                    </h2>
                    <p className="text-gray-400 text-center mb-8 text-sm">
                        {mode === 'login' && 'Acesse sua conta'}
                        {mode === 'signup' && 'Cadastre-se para continuar'}
                        {mode === 'forgot' && 'Enviaremos um link de recuperação'}
                    </p>

                    {/* Message */}
                    {message && (
                        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('✅')
                            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                            : 'bg-red-500/10 border border-red-500/30 text-red-400'
                            }`}>
                            {message}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Nome Completo</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-600 focus:ring-2 focus:ring-yellow-600/20 transition-all"
                                        placeholder="Seu nome"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-600 focus:ring-2 focus:ring-yellow-600/20 transition-all"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {mode !== 'forgot' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-12 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-600 focus:ring-2 focus:ring-yellow-600/20 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        )}

                        {mode === 'login' && (
                            <div className="flex items-center justify-between text-sm">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-yellow-600 focus:ring-yellow-600 focus:ring-offset-0"
                                    />
                                    <span className="ml-2 text-gray-400">Lembrar-me</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setMode('forgot')}
                                    className="text-yellow-600 hover:text-yellow-500 transition-colors"
                                >
                                    Esqueci minha senha
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-yellow-600/20"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                            ) : (
                                <>
                                    {mode === 'login' && 'Entrar'}
                                    {mode === 'signup' && 'Criar Conta'}
                                    {mode === 'forgot' && 'Enviar Link'}
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                    </form>

                    {/* Footer Links */}
                    <div className="mt-6 text-center">
                        {mode === 'login' && (
                            <p className="text-gray-400 text-sm">
                                Não tem uma conta?{' '}
                                <button
                                    onClick={() => setMode('signup')}
                                    className="text-yellow-600 hover:text-yellow-500 font-medium transition-colors"
                                >
                                    Cadastre-se
                                </button>
                            </p>
                        )}
                        {(mode === 'signup' || mode === 'forgot') && (
                            <p className="text-gray-400 text-sm">
                                Já tem uma conta?{' '}
                                <button
                                    onClick={() => setMode('login')}
                                    className="text-yellow-600 hover:text-yellow-500 font-medium transition-colors"
                                >
                                    Fazer login
                                </button>
                            </p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-600 text-xs mt-8">
                    © 2024 Rúbia Joias & Acessórios. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default Login;
