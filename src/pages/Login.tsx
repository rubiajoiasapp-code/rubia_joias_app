import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';

const translateAuthError = (msg?: string): string => {
    if (!msg) return 'Erro desconhecido';
    const m = msg.toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Email ou senha incorretos';
    if (m.includes('email rate limit')) return 'Muitas tentativas. Tente novamente em alguns minutos.';
    if (m.includes('password') && m.includes('short')) return 'A senha é muito curta (mínimo 6 caracteres)';
    if (m.includes('email not confirmed')) return 'Confirme seu email antes de fazer login';
    if (m.includes('failed to fetch')) return 'Erro de conexão. Verifique sua internet.';
    return msg;
};

// Não existe cadastro nesta tela, e isso é proposital: as políticas de RLS do banco são
// `FOR ALL TO authenticated`, ou seja, qualquer conta logada é tratada como a dona da
// loja. Conta nova = acesso total a clientes, vendas e crediário. Usuário se cria pelo
// painel do Supabase (Authentication > Users > Add user).
type Modo = 'login' | 'forgot' | 'reset';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { signIn, resetPassword } = useAuth();

    const initialMode: Modo =
        typeof window !== 'undefined' && window.location.pathname === '/reset-password'
            ? 'reset'
            : 'login';
    const [mode, setMode] = useState<Modo>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
        } catch (error: unknown) {
            setMessage('Erro: ' + translateAuthError(error instanceof Error ? error.message : undefined));
        } finally {
            setLoading(false);
        }
    };

    const titulo = {
        login: 'Bem-vinda',
        forgot: 'Recuperar Senha',
        reset: 'Redefinir Senha',
    }[mode];

    const subtitulo = {
        login: 'Acesse sua conta',
        forgot: 'Enviaremos um link de recuperação',
        reset: 'Escolha uma nova senha de acesso',
    }[mode];

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Brilho decorativo — dourado escuro, para não competir com o logotipo */}
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-gradient-to-br from-ouro-700/20 to-transparent rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-gradient-to-tl from-ouro-800/20 to-transparent rounded-full blur-3xl"></div>

            <div className="w-full max-w-md relative z-10 py-8">
                {/* Logotipo. object-contain é obrigatório: sem ele, o contêiner quadrado
                    achata qualquer arte que não seja exatamente 1:1. */}
                <div className="text-center mb-8 animate-fade-in">
                    <img
                        src="/logo.png"
                        alt="Rúbia Jóias & Acessórios"
                        className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto drop-shadow-2xl"
                    />
                </div>

                {/* Card */}
                <div className="bg-gradient-to-b from-neutral-900 to-black border border-ouro-800/50 rounded-2xl shadow-2xl shadow-black/60 p-8">
                    <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-ouro-300 to-ouro-500 bg-clip-text text-transparent">
                        {titulo}
                    </h2>
                    <p className="text-neutral-400 text-center mb-8 text-sm">
                        {subtitulo}
                    </p>

                    {/* Message */}
                    {message && (
                        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('✅')
                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                            : 'bg-red-500/10 border border-red-500/30 text-red-300'
                            }`}>
                            {message}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-2">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-neutral-900/70 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-ouro-600 focus:ring-2 focus:ring-ouro-600/25 transition-all"
                                    placeholder="seu@email.com"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                        </div>

                        {mode !== 'forgot' && (
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">Senha</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-5 h-5" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 pr-12 py-3 bg-neutral-900/70 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-ouro-600 focus:ring-2 focus:ring-ouro-600/25 transition-all"
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
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
                                        className="w-4 h-4 rounded border-neutral-700 bg-neutral-900 text-ouro-600 focus:ring-ouro-600 focus:ring-offset-0"
                                    />
                                    <span className="ml-2 text-neutral-400">Lembrar-me</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setMode('forgot')}
                                    className="text-ouro-400 hover:text-ouro-300 transition-colors"
                                >
                                    Esqueci minha senha
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-ouro-600 to-ouro-400 hover:from-ouro-500 hover:to-ouro-300 text-black font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-ouro-900/40"
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                            ) : (
                                <>
                                    {mode === 'login' && 'Entrar'}
                                    {mode === 'forgot' && 'Enviar Link'}
                                    {mode === 'reset' && 'Continuar'}
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {mode !== 'login' && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setMode('login')}
                                className="text-ouro-400 hover:text-ouro-300 text-sm font-medium transition-colors"
                            >
                                Voltar para o login
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-neutral-600 text-xs mt-8">
                    © {new Date().getFullYear()} Rúbia Jóias &amp; Acessórios. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default Login;
