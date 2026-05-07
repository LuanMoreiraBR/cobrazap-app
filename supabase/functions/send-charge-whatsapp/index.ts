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


function cleanDescription(description: string | null | undefined) {
  return String(description || 'cobrança')
    .replace(/\s*-\s*Parcela\s+\d+\/\d+$/i, '')
    .trim()
}

function buildChargeTemplateVariables(charge: any) {
  const client = Array.isArray(charge?.client) ? charge.client[0] : charge?.client

  return {
    '1': client?.name || 'cliente',
    '2': cleanDescription(charge?.description),
    '3': formatCurrencyBRL(charge?.amount),
    '4': formatDateBR(charge?.due_date),
    '5': charge?.payment_url || '',
  }
}

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável ${name} não configurada.`)
  return value
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

function formatCurrencyBR(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function formatDateBR(dateString: string | null | undefined) {
  if (!dateString) return '-'

  const date = new Date(`${dateString}T00:00:00`)

  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function getClientName(charge: any) {
  return charge?.client?.name || 'cliente'
}

function getChargeDescription(charge: any) {
  const description = charge?.description || 'cobrança'

  if (charge?.payment_type !== 'installment') {
    return description
  }

  return description.replace(/\s*-\s*Parcela\s+\d+\/\d+$/i, '').trim()
}

function getInstallmentText(charge: any) {
  if (charge?.payment_type !== 'installment') return ''

  const number = charge?.installment_number || '-'
  const total = charge?.installment_total || '-'

  return `Parcela ${number}/${total}`
}

function buildChargeWhatsAppMessage(charge: any) {
  const clientName = getClientName(charge)
  const description = getChargeDescription(charge)
  const amount = formatCurrencyBR(Number(charge?.amount || 0))
  const dueDate = formatDateBR(charge?.due_date)
  const installmentText = getInstallmentText(charge)
  const paymentUrl = charge?.payment_url || ''
  const pix = charge?.pix_qr_code || ''
  const creditCardEnabled = charge?.credit_card_enabled === true

  const paymentInstructions = creditCardEnabled
    ? `Para pagar, acesse o link seguro do Mercado Pago abaixo.

Você poderá escolher Pix ou cartão de crédito:

${paymentUrl || 'Link de pagamento indisponível no momento.'}`
    : `Para pagar via Pix, use o código copia e cola abaixo:

${pix || 'Pix indisponível no momento.'}

${paymentUrl ? `Link de pagamento:\n${paymentUrl}` : ''}`

  if (charge?.payment_type === 'installment') {
    return `Olá ${clientName}, tudo bem?

Esta é a ${installmentText} da sua dívida.

Descrição: ${description}
Valor da parcela: ${amount}
Vencimento: ${dueDate}

${paymentInstructions}

Após pagar, responda PAGO nesta conversa para consultar a confirmação.`
  }

  return `Olá ${clientName}, tudo bem?

Passando para lembrar sobre a cobrança referente a "${description}", no valor de ${amount}, com vencimento em ${dueDate}.

${paymentInstructions}

Após pagar, responda PAGO nesta conversa para consultar a confirmação.`
}

const FREE_TRIAL_MESSAGE_LIMIT = 10

function getCurrentYearMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

async function canSendMessageForUser(supabase: any, userId: string) {
  const yearMonth = getCurrentYearMonth()

  const { data: subscription, error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:platform_plans (*)
    `)
    .eq('user_id', userId)
    .maybeSingle()

  if (subscriptionError) throw subscriptionError

  const hasActivePlan =
    subscription?.status === 'active' &&
    (!subscription.current_period_end ||
      new Date(subscription.current_period_end) > new Date())

  const maxMessages = hasActivePlan
    ? Number(subscription.plan?.max_messages_per_month || 0)
    : FREE_TRIAL_MESSAGE_LIMIT

  if (!maxMessages) {
    return {
      allowed: true,
      reason: 'Plano ilimitado.',
    }
  }

  const { data: usage, error: usageError } = await supabase
    .from('user_monthly_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle()

  if (usageError) throw usageError

  const messagesSent = Number(usage?.messages_sent || 0)

  if (messagesSent >= maxMessages) {
    return {
      allowed: false,
      reason: hasActivePlan
        ? `Limite mensal de mensagens atingido: ${messagesSent}/${maxMessages}.`
        : `Você usou suas ${FREE_TRIAL_MESSAGE_LIMIT} mensagens grátis. Escolha um plano para continuar enviando cobranças.`,
    }
  }

  return {
    allowed: true,
    reason: 'Dentro do limite.',
  }
}

async function incrementMessageUsage({
  supabase,
  userId,
  chargeId,
}: {
  supabase: any
  userId: string
  chargeId: string
}) {
  const { error } = await supabase.rpc('register_message_usage_with_credits', {
    p_user_id: userId,
    p_source_table: 'charges',
    p_source_id: chargeId,
  })

  if (error) {
    console.error('Erro ao contabilizar uso mensal:', error)
    throw error
  }
}

async function sendWithTwilio({
  to,
  text,
  contentVariables,
}: {
  to: string
  text: string
  contentVariables?: Record<string, string>
}) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = getEnv('TWILIO_MESSAGING_SERVICE_SID')
  const chargeTemplateSid = Deno.env.get('TWILIO_CHARGE_TEMPLATE_SID') || ''

  const body = new URLSearchParams()
  body.set('MessagingServiceSid', messagingServiceSid)
  body.set('To', to)

  if (chargeTemplateSid && contentVariables) {
    body.set('ContentSid', chargeTemplateSid)
    body.set('ContentVariables', JSON.stringify(contentVariables))
  } else {
    body.set('Body', text)
  }

  const auth = btoa(`${accountSid}:${authToken}`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Erro Twilio: ${JSON.stringify(data)}`)
  }

  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)
  }

  try {
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

    const supabaseUrl = getEnv('SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

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

    if (chargeError || !charge) {
      return jsonResponse(
        {
          ok: false,
          error: chargeError?.message || 'Cobrança não encontrada.',
        },
        404,
      )
    }

    if (charge.status === 'pago') {
      return jsonResponse(
        {
          ok: false,
          error: 'Cobrança já está paga.',
        },
        400,
      )
    }

    const to = formatWhatsAppTo(charge?.client?.phone)

    if (!to) {
      return jsonResponse(
        {
          ok: false,
          error: 'Cliente sem telefone válido.',
        },
        400,
      )
    }

    if (!charge.pix_qr_code && !charge.payment_url) {
      return jsonResponse(
        {
          ok: false,
          error: 'A cobrança ainda não possui Pix ou link de pagamento.',
        },
        400,
      )
    }

    const permission = await canSendMessageForUser(supabase, user_id)

if (!permission.allowed) {
  return jsonResponse(
    {
      ok: false,
      error: permission.reason,
      billing_required: true,
    },
    402,
  )
}

    const message = buildChargeWhatsAppMessage(charge)
    const twilioMessage = await sendWithTwilio({
  to,
  text: message,
  contentVariables: buildChargeTemplateVariables(charge),
})

await incrementMessageUsage({
  supabase,
  userId: user_id,
  chargeId: charge.id,
})

    const { data: updatedCharge, error: updateError } = await supabase
      .from('charges')
      .update({
        whatsapp_message_sid: twilioMessage.sid,
        whatsapp_message_status: twilioMessage.status || 'accepted',
        whatsapp_sent_at: new Date().toISOString(),
        whatsapp_error: null,
      })
      .eq('id', charge.id)
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

    if (updateError) {
      console.error('Erro ao atualizar status WhatsApp:', updateError)
    }

    return jsonResponse({
      ok: true,
      message_sid: twilioMessage.sid,
      status: twilioMessage.status,
      charge: updatedCharge || charge,
    })
  } catch (error) {
    console.error('Erro ao enviar cobrança por WhatsApp:', error)

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Erro ao enviar cobrança por WhatsApp.',
      },
      500,
    )
  }
})