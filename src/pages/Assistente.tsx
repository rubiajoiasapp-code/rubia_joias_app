import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mensagemDeErro } from '../lib/erro';

/**
 * Assistente de consulta em linguagem natural.
 *
 * A pergunta vai para a Edge Function `assistente`, que fala com o Gemini. A chave do
 * modelo nunca passa por aqui — tudo que é VITE_ vai embutido no bundle e é público.
 *
 * Somente consulta: o assistente lê e responde, nunca grava. Registrar pagamento,
 * cadastrar produto e afins continua nas telas próprias, onde há confirmação e histórico.
 */

interface Mensagem {
    de: 'usuaria' | 'assistente';
    texto: string;
    erro?: boolean;
}

const SUGESTOES = [
    'Quanto vendi esse mês?',
    'O que vence essa semana?',
    'Quem está com parcela atrasada?',
    'O que está acabando no estoque?',
];

const Assistente: React.FC = () => {
    const [mensagens, setMensagens] = useState<Mensagem[]>([]);
    const [pergunta, setPergunta] = useState('');
    const [carregando, setCarregando] = useState(false);
    const fimDaLista = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fimDaLista.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensagens, carregando]);

    const perguntar = async (texto: string) => {
        const limpo = texto.trim();
        if (!limpo || carregando) return;

        setMensagens(m => [...m, { de: 'usuaria', texto: limpo }]);
        setPergunta('');
        setCarregando(true);

        try {
            // invoke já manda o token da sessão no cabeçalho; a função recusa sem ele.
            const { data, error } = await supabase.functions.invoke('assistente', {
                body: { pergunta: limpo },
            });

            if (error) {
                // `invoke` transforma qualquer resposta fora da faixa 2xx num
                // FunctionsHttpError com a mensagem genérica "non-2xx status code", e
                // guarda a resposta de verdade em `.context`. Sem abrir esse corpo, o
                // motivo real do erro nunca chega à tela — nem para quem for depurar.
                const resposta = (error as { context?: Response }).context;
                const corpo = resposta && typeof resposta.json === 'function'
                    ? await resposta.json().catch(() => null)
                    : null;
                throw new Error(corpo?.erro ? String(corpo.erro) : mensagemDeErro(error));
            }
            if (data?.erro) throw new Error(data.erro);

            setMensagens(m => [...m, { de: 'assistente', texto: String(data?.resposta ?? '') }]);
        } catch (e: unknown) {
            setMensagens(m => [
                ...m,
                { de: 'assistente', texto: mensagemDeErro(e, 'Não consegui responder agora.'), erro: true },
            ]);
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
            <div className="mb-4">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-pink-600" />
                    Assistente
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Pergunte sobre vendas, crediário e estoque. Ele só consulta — não altera nada.
                </p>
            </div>

            <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                {mensagens.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <Sparkles className="w-10 h-10 text-pink-200 mb-3" />
                        <p className="text-gray-500 text-sm mb-4">Experimente perguntar:</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {SUGESTOES.map(s => (
                                <button
                                    key={s}
                                    onClick={() => perguntar(s)}
                                    className="px-3 py-2 text-sm rounded-full border border-pink-200 text-pink-700 hover:bg-pink-50 transition-colors"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {mensagens.map((m, i) => (
                    <div key={i} className={`flex ${m.de === 'usuaria' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.de === 'usuaria'
                                ? 'bg-pink-600 text-white rounded-br-sm'
                                : m.erro
                                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                                }`}
                        >
                            {m.erro && <AlertCircle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />}
                            {m.texto}
                        </div>
                    </div>
                ))}

                {carregando && (
                    <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            consultando…
                        </div>
                    </div>
                )}

                <div ref={fimDaLista} />
            </div>

            <form
                onSubmit={e => {
                    e.preventDefault();
                    perguntar(pergunta);
                }}
                className="mt-3 flex gap-2"
            >
                <input
                    value={pergunta}
                    onChange={e => setPergunta(e.target.value)}
                    placeholder="Pergunte alguma coisa…"
                    maxLength={500}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition-all"
                />
                <button
                    type="submit"
                    disabled={carregando || !pergunta.trim()}
                    aria-label="Enviar pergunta"
                    className="px-5 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>

            <p className="text-xs text-gray-400 mt-2 text-center">
                Respostas geradas por IA podem conter erro. Confira na tela correspondente antes de cobrar alguém.
            </p>
        </div>
    );
};

export default Assistente;
