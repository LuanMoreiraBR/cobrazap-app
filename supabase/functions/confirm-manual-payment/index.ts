import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function formatCurrencyBRL(amount: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(amount || 0))
}

function onlyDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function formatWhatsAppTo(phone: string | null | undefined) {
  const digits = onlyDigits(phone)

  if (!digits) return ''

  const phoneWithCountryCode = digits.startsWith('55') ? digits : `55${digits}`

  return `whatsapp:+${phoneWithCountryCode}`
}



function buildPaymentConfirmationMessage({
  clientName,
  description,
  amount,
}: {
  clientName: string
  description: string
  amount: number | string
}) {
  const value = formatCurrencyBRL(amount)

  return `Olá ${clientName}, tudo bem?

Pagamento recebido com sucesso! ✅

Referente à cobrança: "${description}"
Valor: ${value}

Muito obrigado!`
}

async function sendTwilioWhatsAppMessage({
  to,
  body,
}: {
  to: string
  body: string
}) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')

  if (!accountSid || !authToken || !messagingServiceSid) {
    console.error('Twilio não configurado.', {
      hasAccountSid: Boolean(accountSid),
      hasAuthToken: Boolean(authToken),
      hasMessagingServiceSid: Boolean(messagingServiceSid),
    })

    throw new Error('Twilio não configurado para envio de confirmação.')
  }

  if (!to) {
    throw new Error('Telefone do cliente vazio. Confirmação não enviada.')
  }

  const credentials = btoa(`${accountSid}:${authToken}`)

  const params = new URLSearchParams()
  params.set('MessagingServiceSid', messagingServiceSid)
  params.set('To', to)
  params.set('Body', body)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    },
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro ao enviar confirmação Twilio:', data)
    throw new Error(data?.message || 'Erro ao enviar confirmação pelo WhatsApp.')
  }

  return {
    skipped: false,
    sid: data.sid,
    status: data.status,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const { charge_id, user_id } = await req.json()

    if (!charge_id || !user_id) {
      return jsonResponse(
        {
          ok: false,
          error: 'charge_id e user_id são obrigatórios.',
        },
        400,
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select(
        `
        *,
        client:clients (
          id,
          name,
          phone
        )
      `,
      )
      .eq('id', charge_id)
      .eq('user_id', user_id)
      .single()

    if (chargeError) throw chargeError
    if (!charge) throw new Error('Cobrança não encontrada.')

    const { error: processedEventError } = await supabase
      .from('processed_payment_events')
      .insert({
        provider: 'manual',
        payment_id: String(charge.id),
        charge_id: charge.id,
        event_status: 'paid',
      })

    if (processedEventError) {
      if (String(processedEventError.code) === '23505') {
        return jsonResponse({
          ok: true,
          ignored: true,
          reason: 'Confirmação manual já processada anteriormente.',
          charge,
        })
      }

      throw processedEventError
    }

    const paidAt = charge.paid_at || new Date().toISOString()

    const { data: updatedCharge, error: updateError } = await supabase
      .from('charges')
      .update({
        status: 'pago',
        paid_at: paidAt,
        payment_provider: charge.payment_provider || 'manual',
        payment_status: charge.payment_status || 'manual_paid',
        payment_confirmation_sent_at: new Date().toISOString(),
        payment_confirmation_provider: 'twilio',
      })
      .eq('id', charge.id)
      .eq('user_id', user_id)
      .select(
        `
        *,
        client:clients (
          id,
          name,
          phone
        )
      `,
      )
      .single()

    if (updateError) throw updateError

    const { error: scheduledError } = await supabase
      .from('scheduled_messages')
      .update({
        status: 'cancelled',
        error_message: 'Cobrança marcada como paga manualmente.',
      })
      .eq('charge_id', charge.id)
      .eq('status', 'pending')

    if (scheduledError) throw scheduledError

    const client = Array.isArray(charge.client) ? charge.client[0] : charge.client

    const to = formatWhatsAppTo(client?.phone)

    const confirmationMessage = buildPaymentConfirmationMessage({
      clientName: client?.name || 'cliente',
      description: charge.description || 'cobrança',
      amount: charge.amount || 0,
    })

    const twilioResult = await sendTwilioWhatsAppMessage({
      to,
      body: confirmationMessage,
    })

    return jsonResponse({
      ok: true,
      charge: updatedCharge,
      confirmation_sent: !twilioResult.skipped,
      twilio: twilioResult,
    })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado.',
      },
      500,
    )
  }
})