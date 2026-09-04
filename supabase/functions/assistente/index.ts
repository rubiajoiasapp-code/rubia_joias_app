// Supabase Edge Function: assistente
//
// Responde perguntas sobre a loja em linguagem natural: "quanto a Maria ainda me deve?",
// "quanto vendi esse mes?", "o que vence essa semana?".
//
// POR QUE AQUI, E NAO NO NAVEGADOR
// A chave do Gemini nao pode ir para o frontend: tudo que e VITE_ fica embutido no
// bundle JS e qualquer pessoa le. Esta funcao e o unico lugar do projeto que roda no
// servidor, entao e aqui que o segredo mora.
//
// DUAS DECISOES DE SEGURANCA
//
// 1. NAO usa service_role. As consultas vao com o JWT de quem chamou, entao o assistente
//    tem exatamente os privilegios da usuaria logada — nem um a mais. Uma funcao com
//    service_role exposta na internet e uma chave-mestra atras de um endpoint: quem
//    descobrisse a URL leria o banco inteiro, RLS ignorado.
//
// 2. Nenhuma ferramenta devolve CPF, telefone ou endereco. Isso vale para qualquer
//    provedor, mas pesa mais no Gemini gratuito, em que o Google pode usar o conteudo
//    enviado para melhorar os modelos dele. O assistente responde sobre dinheiro e
//    prazos; para isso, nome e valor bastam.
//
// CONFIGURAR
//   supabase secrets set GEMINI_API_KEY=...
//   supabase functions deploy assistente

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Flash-Lite: o mais barato da familia e sobra para consulta com ferramenta pronta.
// A conta e feita pelas ferramentas; o modelo so escolhe qual chamar e redige a resposta.
const MODELO = 'gemini-3.5-flash-lite'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// Teto de rodadas de ferramenta. Sem isso, um modelo confuso pode ficar chamando
// ferramenta em circulo e queimar cota — no gratuito sao ~15 requisicoes por minuto.
const MAX_RODADAS = 4

const INSTRUCAO = `Voce e o assistente do sistema de gestao de uma joalheria pequena, e fala com a dona da loja.

Responda SEMPRE em portugues do Brasil, de forma curta e direta. Valores em reais no formato R$ 1.234,56.

Use as ferramentas para buscar os numeros. Nunca invente valor, data ou nome de cliente:
se a ferramenta nao devolveu o dado, diga que nao encontrou.

Quando a pergunta for sobre uma cliente e houver mais de uma com nome parecido, liste as
opcoes em vez de escolher uma.

Voce e somente consulta. Se pedirem para registrar pagamento, apagar ou alterar qualquer
coisa, explique que isso e feito na tela correspondente do sistema.`

/** Data de hoje em Brasilia. O servidor pensa em UTC; a loja, nao. */
function hojeBR(): string {
    return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
}

function somaDias(iso: string, dias: number): string {
    const [a, m, d] = iso.split('-').map(Number)
    const data = new Date(Date.UTC(a, m - 1, d))
    data.setUTCDate(data.getUTCDate() + dias)
    return data.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------

const FERRAMENTAS = [
    {
        type: 'function',
        name: 'saldo_da_cliente',
        description:
            'Quanto uma cliente ainda deve no crediario, com as parcelas em aberto. Use quando a pergunta for sobre o que uma pessoa especifica deve.',
        parameters: {
            type: 'object',
            properties: {
                nome: { type: 'string', description: 'Nome ou parte do nome da cliente' },
            },
            required: ['nome'],
        },
    },
    {
        type: 'function',
        name: 'vendas_no_periodo',
        description:
            'Total vendido, quantidade de vendas e ticket medio entre duas datas. Use para "quanto vendi este mes", "e a semana passada", etc.',
        parameters: {
            type: 'object',
            properties: {
                inicio: { type: 'string', description: 'Data inicial, formato AAAA-MM-DD' },
                fim: { type: 'string', description: 'Data final inclusiva, formato AAAA-MM-DD' },
            },
            required: ['inicio', 'fim'],
        },
    },
    {
        type: 'function',
        name: 'parcelas_a_vencer',
        description:
            'Parcelas de crediario em aberto que vencem nos proximos N dias, mais as ja vencidas. Use para "o que vence essa semana", "quem esta atrasado".',
        parameters: {
            type: 'object',
            properties: {
                dias: { type: 'number', description: 'Quantos dias para a frente olhar (padrao 7)' },
            },
            required: [],
        },
    },
    {
        type: 'function',
        name: 'estoque_baixo',
        description: 'Produtos com estoque igual ou abaixo de um limite. Use para "o que esta acabando".',
        parameters: {
            type: 'object',
            properties: {
                limite: { type: 'number', description: 'Estoque maximo para entrar na lista (padrao 3)' },
            },
            required: [],
        },
    },
]

type Args = Record<string, unknown>

/**
 * Executa a ferramenta pedida.
 *
 * Todo `select` aqui e explicito e nunca inclui cpf, telefone ou endereco — a lista de
 * colunas E a fronteira de privacidade. `select('*')` neste arquivo seria um vazamento.
 */
async function executar(nome: string, args: Args, db: SupabaseClient): Promise<unknown> {
    switch (nome) {
        case 'saldo_da_cliente': {
            const busca = String(args.nome ?? '').trim()
            if (!busca) return { erro: 'nome nao informado' }

            const { data: clientes, error: e1 } = await db
                .from('clientes')
                .select('id, nome')
                .ilike('nome', `%${busca}%`)
                .limit(10)
            if (e1) return { erro: e1.message }
            if (!clientes?.length) return { encontrado: false, mensagem: 'Nenhuma cliente com esse nome.' }
            if (clientes.length > 1) {
                return { varias: clientes.map((c) => c.nome) }
            }

            const cliente = clientes[0]
            const { data: vendas, error: e2 } = await db
                .from('vendas')
                .select('id')
                .eq('cliente_id', cliente.id)
            if (e2) return { erro: e2.message }

            const ids = (vendas ?? []).map((v) => v.id)
            if (!ids.length) return { cliente: cliente.nome, deve: 0, parcelas: [] }

            const { data: parcelas, error: e3 } = await db
                .from('parcelas_venda')
                .select('numero_parcela, valor_parcela, valor_pago, saldo_devedor, data_vencimento')
                .in('venda_id', ids)
                .eq('pago', false)
                .order('data_vencimento')
            if (e3) return { erro: e3.message }

            const hoje = hojeBR()
            const abertas = parcelas ?? []
            return {
                cliente: cliente.nome,
                // saldo_devedor, nao valor_parcela: com pagamento parcial, somar o valor
                // cheio cobraria de novo o que a cliente ja pagou.
                deve: abertas.reduce((s, p) => s + Number(p.saldo_devedor), 0),
                atrasadas: abertas.filter((p) => p.data_vencimento < hoje).length,
                parcelas: abertas.map((p) => ({
                    numero: p.numero_parcela,
                    vence: p.data_vencimento,
                    falta: Number(p.saldo_devedor),
                    ja_pago: Number(p.valor_pago),
                    atrasada: p.data_vencimento < hoje,
                })),
            }
        }

        case 'vendas_no_periodo': {
            const inicio = String(args.inicio ?? '')
            const fim = String(args.fim ?? '')
            if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
                return { erro: 'datas devem estar em AAAA-MM-DD' }
            }

            const { data, error } = await db
                .from('vendas')
                .select('valor_total, forma_pagamento')
                .gte('data_venda', inicio)
                .lte('data_venda', `${fim}T23:59:59`)
            if (error) return { erro: error.message }

            const vendas = data ?? []
            const total = vendas.reduce((s, v) => s + Number(v.valor_total), 0)
            const porForma: Record<string, number> = {}
            for (const v of vendas) {
                const forma = v.forma_pagamento ?? 'NAO_INFORMADO'
                porForma[forma] = (porForma[forma] ?? 0) + Number(v.valor_total)
            }
            return {
                inicio,
                fim,
                quantidade: vendas.length,
                total,
                ticket_medio: vendas.length ? total / vendas.length : 0,
                por_forma_de_pagamento: porForma,
            }
        }

        case 'parcelas_a_vencer': {
            const dias = Number(args.dias ?? 7)
            const hoje = hojeBR()
            const limite = somaDias(hoje, Number.isFinite(dias) ? dias : 7)

            const { data, error } = await db
                .from('parcelas_venda')
                .select('numero_parcela, saldo_devedor, data_vencimento, venda:vendas(cliente:clientes(nome))')
                .eq('pago', false)
                .lte('data_vencimento', limite)
                .order('data_vencimento')
                .limit(100)
            if (error) return { erro: error.message }

            const linhas = (data ?? []).map((p) => {
                // Relacionamento embutido chega ora como objeto, ora como array de um.
                const venda = Array.isArray(p.venda) ? p.venda[0] : p.venda
                const cli = venda && (Array.isArray(venda.cliente) ? venda.cliente[0] : venda.cliente)
                return {
                    cliente: cli?.nome ?? 'sem cliente',
                    numero: p.numero_parcela,
                    vence: p.data_vencimento,
                    falta: Number(p.saldo_devedor),
                    atrasada: p.data_vencimento < hoje,
                }
            })

            return {
                hoje,
                ate: limite,
                quantidade: linhas.length,
                total: linhas.reduce((s, l) => s + l.falta, 0),
                atrasadas: linhas.filter((l) => l.atrasada).length,
                parcelas: linhas,
            }
        }

        case 'estoque_baixo': {
            const limite = Number(args.limite ?? 3)
            const { data, error } = await db
                .from('produtos')
                .select('descricao, categoria, quantidade_estoque')
                .lte('quantidade_estoque', Number.isFinite(limite) ? limite : 3)
                .order('quantidade_estoque')
                .limit(50)
            if (error) return { erro: error.message }
            return { limite, quantidade: data?.length ?? 0, produtos: data ?? [] }
        }

        default:
            return { erro: `ferramenta desconhecida: ${nome}` }
    }
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

interface PassoGemini {
    type: string
    id?: string
    name?: string
    arguments?: Args
}

interface RespostaGemini {
    output_text?: string
    steps?: PassoGemini[]
    error?: { message?: string }
}

async function chamarGemini(chave: string, corpo: Record<string, unknown>): Promise<RespostaGemini> {
    const r = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'x-goog-api-key': chave, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODELO, system_instruction: INSTRUCAO, tools: FERRAMENTAS, ...corpo }),
    })

    const json = await r.json().catch(() => ({}))
    if (!r.ok) {
        // 429 e o caso comum no gratuito: 5-15 requisicoes por minuto.
        const detalhe = json?.error?.message ?? `HTTP ${r.status}`
        throw new Error(r.status === 429 ? `Muitas perguntas seguidas. Espere um minuto. (${detalhe})` : detalhe)
    }
    return json as RespostaGemini
}

// ---------------------------------------------------------------------------

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const responder = (corpo: unknown, status = 200) =>
        new Response(JSON.stringify(corpo), {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    try {
        const chave = Deno.env.get('GEMINI_API_KEY')
        if (!chave) return responder({ erro: 'GEMINI_API_KEY nao configurada na funcao.' }, 500)

        // Autenticacao: sem sessao valida, nao responde. Sem isto, quem descobrisse a URL
        // consultaria o crediario da loja inteira.
        const autorizacao = req.headers.get('Authorization') ?? ''
        if (!autorizacao.startsWith('Bearer ')) return responder({ erro: 'Nao autenticado.' }, 401)

        // Cliente com a chave anon MAIS o JWT de quem chamou: as consultas passam pelo RLS
        // como a propria usuaria. Nada aqui roda com privilegio maior que o dela.
        const db = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: autorizacao } }, auth: { persistSession: false } },
        )

        const { data: usuario, error: erroAuth } = await db.auth.getUser()
        if (erroAuth || !usuario?.user) return responder({ erro: 'Sessao invalida ou expirada.' }, 401)

        const { pergunta } = await req.json().catch(() => ({ pergunta: '' }))
        if (typeof pergunta !== 'string' || !pergunta.trim()) {
            return responder({ erro: 'Pergunta vazia.' }, 400)
        }
        if (pergunta.length > 500) return responder({ erro: 'Pergunta longa demais.' }, 400)

        // Data de hoje vai junto: o modelo nao sabe que dia e, e "esse mes" depende disso.
        const entrada: unknown[] = [
            { type: 'user_input', content: `Hoje e ${hojeBR()}.\n\n${pergunta.trim()}` },
        ]

        const ferramentasUsadas: string[] = []
        let resposta = await chamarGemini(chave, { store: false, input: entrada })

        for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
            const chamadas = (resposta.steps ?? []).filter((p) => p.type === 'function_call')
            if (chamadas.length === 0) break

            const resultados = await Promise.all(
                chamadas.map(async (c) => {
                    ferramentasUsadas.push(c.name ?? '?')
                    const saida = await executar(c.name ?? '', c.arguments ?? {}, db)
                    return {
                        type: 'function_result',
                        name: c.name,
                        call_id: c.id,
                        result: [{ type: 'text', text: JSON.stringify(saida) }],
                    }
                }),
            )

            entrada.push(...(resposta.steps ?? []), ...resultados)
            resposta = await chamarGemini(chave, { store: false, input: entrada })
        }

        const texto = resposta.output_text?.trim()
        if (!texto) return responder({ erro: 'O assistente nao conseguiu formular a resposta.' }, 502)

        return responder({ resposta: texto, ferramentas: ferramentasUsadas })
    } catch (e) {
        const mensagem = e instanceof Error ? e.message : 'erro desconhecido'
        console.error('assistente:', mensagem)
        return responder({ erro: mensagem }, 500)
    }
})
