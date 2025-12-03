// Supabase Edge Function: send-whatsapp-reminder
// Envia lembretes automáticos via WhatsApp usando CallMeBot

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Installment {
    id: string
    venda_id: string
    numero_parcela: number
    valor_parcela: number
    data_vencimento: string
    pago: boolean
    venda: {
        cliente: {
            nome: string
        }
    }
}

interface NotificationConfig {
    whatsapp_numero: string
    callmebot_api_key: string
    dias_antecedencia: number[]
    ativo: boolean
    enviar_finais_semana: boolean
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Inicializar cliente Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Buscar configurações ativas
        const { data: config, error: configError } = await supabase
            .from('configuracoes_notificacoes')
            .select('*')
            .eq('ativo', true)
            .single()

        if (configError || !config) {
            console.log('Nenhuma configuração ativa encontrada')
            return new Response(
                JSON.stringify({ message: 'Notificações não configuradas ou desativadas' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const notificationConfig = config as NotificationConfig

        // Verificar se deve enviar hoje (finais de semana)
        const hoje = new Date()
        const diaSemana = hoje.getDay() // 0 = Domingo, 6 = Sábado
        const isFinalSemana = diaSemana === 0 || diaSemana === 6

        if (isFinalSemana && !notificationConfig.enviar_finais_semana) {
            console.log('Hoje é final de semana e envio está desativado')
            return new Response(
                JSON.stringify({ message: 'Envio de lembretes desativado para finais de semana' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Buscar parcelas vencendo nos dias configurados
        const datasAlerta: string[] = []
        notificationConfig.dias_antecedencia.forEach(dias => {
            const data = new Date()
            data.setDate(data.getDate() + dias)
            datasAlerta.push(data.toISOString().split('T')[0])
        })

        const { data: parcelas, error: parcelasError } = await supabase
            .from('parcelas_venda')
            .select(`
        id,
        venda_id,
        numero_parcela,
        valor_parcela,
        data_vencimento,
        pago,
        venda:vendas!inner (
          cliente:clientes!inner (
            nome
          )
        )
      `)
            .in('data_vencimento', datasAlerta)
            .eq('pago', false)
            .order('data_vencimento', { ascending: true })

        if (parcelasError) {
            throw new Error(`Erro ao buscar parcelas: ${parcelasError.message}`)
        }

        if (!parcelas || parcelas.length === 0) {
            console.log('Nenhuma parcela vencendo nos próximos dias')
            return new Response(
                JSON.stringify({ message: 'Nenhuma parcela vencendo' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // Agrupar parcelas por data
        const parcelasHoje: Installment[] = []
        const parcelas2Dias: Installment[] = []
        const parcelas3Dias: Installment[] = []

        const dataHoje = new Date().toISOString().split('T')[0]
        const data2Dias = new Date()
        data2Dias.setDate(data2Dias.getDate() + 2)
        const data2DiasStr = data2Dias.toISOString().split('T')[0]
        const data3Dias = new Date()
        data3Dias.setDate(data3Dias.getDate() + 3)
        const data3DiasStr = data3Dias.toISOString().split('T')[0]

        parcelas.forEach((parcela: any) => {
            const parcelaCompleta: Installment = {
                id: parcela.id,
                venda_id: parcela.venda_id,
                numero_parcela: parcela.numero_parcela,
                valor_parcela: parcela.valor_parcela,
                data_vencimento: parcela.data_vencimento,
                pago: parcela.pago,
                venda: {
                    cliente: {
                        nome: parcela.venda.cliente.nome
                    }
                }
            }

            if (parcela.data_vencimento === dataHoje) {
                parcelasHoje.push(parcelaCompleta)
            } else if (parcela.data_vencimento === data2DiasStr) {
                parcelas2Dias.push(parcelaCompleta)
            } else if (parcela.data_vencimento === data3DiasStr) {
                parcelas3Dias.push(parcelaCompleta)
            }
        })

        // Formatar mensagem
        const formatarData = (dateStr: string) => {
            const date = new Date(dateStr + 'T00:00:00')
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        }

        let mensagem = `🔔 *LEMBRETES RUBIA JOIAS* - ${formatarData(dataHoje)}\n\n`

        if (parcelasHoje.length > 0) {
            mensagem += `🔴 *VENCENDO HOJE* (${parcelasHoje.length}):\n`
            parcelasHoje.forEach(p => {
                mensagem += `• ${p.venda.cliente.nome} - R$ ${Number(p.valor_parcela).toFixed(2)}\n`
            })
            mensagem += '\n'
        }

        if (parcelas2Dias.length > 0) {
            mensagem += `⚠️ *VENCE EM 2 DIAS* (${parcelas2Dias.length}):\n`
            parcelas2Dias.forEach(p => {
                mensagem += `• ${p.venda.cliente.nome} - R$ ${Number(p.valor_parcela).toFixed(2)}\n`
            })
            mensagem += '\n'
        }

        if (parcelas3Dias.length > 0) {
            mensagem += `📅 *VENCE EM 3 DIAS* (${parcelas3Dias.length}):\n`
            parcelas3Dias.forEach(p => {
                mensagem += `• ${p.venda.cliente.nome} - R$ ${Number(p.valor_parcela).toFixed(2)}\n`
            })
            mensagem += '\n'
        }

        // Calcular total
        const totalReceber = parcelas.reduce((sum: number, p: any) => sum + Number(p.valor_parcela), 0)
        mensagem += `💰 *Total a receber:* R$ ${totalReceber.toFixed(2)}\n\n`
        mensagem += `---\n_Enviado automaticamente pelo sistema Rubia Joias_`

        // Enviar via CallMeBot
        const phone = notificationConfig.whatsapp_numero
        const apiKey = notificationConfig.callmebot_api_key
        const encodedMessage = encodeURIComponent(mensagem)

        const callMeBotUrl = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`

        const response = await fetch(callMeBotUrl)
        const responseText = await response.text()

        if (!response.ok) {
            throw new Error(`Erro ao enviar WhatsApp: ${responseText}`)
        }

        console.log('Mensagem enviada com sucesso:', responseText)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Lembrete enviado com sucesso',
                parcelas_total: parcelas.length,
                mensagem_enviada: mensagem
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        console.error('Erro:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})
