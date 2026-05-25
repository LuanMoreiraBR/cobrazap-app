import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FREE_TRIAL_MESSAGE_LIMIT = 10
const DEFAULT_CHARGE_TEMPLATE_SID = 'HXb61d044c9da80ac9e3554e3a04b485c2'
const DEFAULT_CHARGE_WITH_CONTACT_TEMPLATE_SID =
  'HX6357059b6045c84bd165826e4df981d9'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Variável ${name} não configurada.`)
  }

  return value
}

function getOptionalEnv(name: string, fallback = '') {
  return Deno.env.get(name) || fallback
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

function formatCurrencyBRL(amount: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(amount || 0))
}

function formatDateBR(dateString: string | null | undefined) {
  if (!dateString) return '-'

  const date = new Date(`${dateString}T00:00:00`)

  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function cleanDescription(description: string | null | undefined) {
  return String(description || 'cobrança')
    .replace(/\s*-\s*Parcela\s+\d+\/\d+$/i, '')
    .replace(/\s*-\s*Recorrência\s+\d+\/\d+$/i, '')
    .trim()
}

function getCurrentYearMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

function getClientFromCharge(charge: any) {
  return Array.isArray(charge?.client) ? charge.client[0] : charge?.client
}

function getSupportContactsText(charge: any) {
  const contacts = Array.isArray(charge?.support_whatsapp_contacts)
    ? charge.support_whatsapp_contacts
    : []

  if (!contacts.length) return ''

  return contacts
    .map((contact: any) => {
      const name = contact.name || contact.label || 'Atendimento'
      const phone = onlyDigits(contact.phone)
      return `${name}: +${phone}`
    })
    .join('\n')
}

function buildChargeTemplateVariables(charge: any) {
  const client = getClientFromCharge(charge)
  const supportContactsText = getSupportContactsText(charge)

  const variables: Record<string, string> = {
    '1': String(client?.name || 'cliente'),
    '2': cleanDescription(charge?.description),
    '3': formatCurrencyBRL(charge?.amount),
    '4': formatDateBR(charge?.due_date),
    '5': String(charge?.payment_url || ''),
  }

  if (supportContactsText) {
    variables['6'] = supportContactsText
  }

  return variables
}

function buildChargeWhatsAppMessage(charge: any) {
  const client = getClientFromCharge(charge)
  const clientName = client?.name || 'cliente'
  const description = cleanDescription(charge?.description)
  const amount = formatCurrencyBRL(charge?.amount)
  const dueDate = formatDateBR(charge?.due_date)
  const paymentUrl = charge?.payment_url || ''
  const pix = charge?.pix_qr_code || ''
  const supportContactsText = getSupportContactsText(charge)

  const paymentInstructions = paymentUrl
    ? `Para pagar, acesse o link seguro:\n${paymentUrl}`
    : `Para pagar via Pix, use o código copia e cola abaixo:\n${pix || 'Pix indisponível no momento.'}`

  const supportBlock = supportContactsText
    ? `\n\nDúvidas? Fale com:\n${supportContactsText}`
    : ''

  return `Olá ${clientName}, tudo bem?

Você tem uma cobrança referente a ${description}, no valor de ${amount}, com vencimento em ${dueDate}.

${paymentInstructions}${supportBlock}

Após pagar, responda PAGO nesta conversa para consultar a confirmação.`
}

async function logPlatformEvent({
  supabase,
  provider,
  eventType,
  userId = null,
  relatedTable = null,
  relatedId = null,
  status = 'info',
  message = '',
  requestPayload = {},
  responsePayload = {},
  errorMessage = null,
}: {
  supabase: any
  provider: string
  eventType: string
  userId?: string | null
  relatedTable?: string | null
  relatedId?: string | null
  status?: string
  message?: string
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  errorMessage?: string | null
}) {
  try {
    if (!supabase) return

    await supabase.from('platform_event_logs').insert({
      provider,
      event_type: eventType,
      user_id: userId,
      related_table: relatedTable,
      related_id: relatedId,
      status,
      message,
      request_payload: requestPayload,
      response_payload: responsePayload,
      error_message: errorMessage,
    })
  } catch (error) {
    console.error('Erro ao gravar platform_event_logs:', error)
  }
}

async function getExtraMessageCredits(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('message_credit_purchases')
    .select('remaining')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gt('remaining', 0)

  if (error) throw error

  return (data || []).reduce(
    (total: number, item: any) => total + Number(item.remaining || 0),
    0,
  )
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

  const hasPeriodEnd = Boolean(subscription?.current_period_end)
  const periodExpired = hasPeriodEnd && new Date(subscription.current_period_end) <= new Date()

  // Paid plan that expired → clear renewal prompt instead of silent downgrade
  if (subscription && periodExpired && Number(subscription?.plan?.price ?? 0) > 0) {
    return {
      allowed: false,
      reason: 'Seu plano expirou. Acesse a aba Planos para renovar e continuar enviando cobranças.',
    }
  }

  const hasActivePlan =
    subscription?.status === 'active' && !periodExpired

  const planMessageLimit = hasActivePlan
    ? Number(subscription?.plan?.max_messages_per_month || 0)
    : FREE_TRIAL_MESSAGE_LIMIT

  const extraCredits = await getExtraMessageCredits(supabase, userId)
  const totalMessageLimit = planMessageLimit + extraCredits

  if (!totalMessageLimit) {
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

  if (messagesSent >= totalMessageLimit) {
    return {
      allowed: false,
      reason: hasActivePlan
        ? `Limite mensal de mensagens atingido: ${messagesSent}/${totalMessageLimit}. Compre créditos extras para continuar.`
        : `Você usou suas ${FREE_TRIAL_MESSAGE_LIMIT} mensagens do plano gratuito. Escolha um plano pago para continuar enviando cobranças.`,
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
    console.error('Erro ao contabilizar uso da mensagem:', error)
    throw new Error('Mensagem enviada, mas houve erro ao contabilizar uso.')
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
  const supabaseUrl = getOptionalEnv('SUPABASE_URL').replace(/\/$/, '')

  const chargeTemplateSid = getOptionalEnv(
    'TWILIO_CHARGE_TEMPLATE_SID',
    DEFAULT_CHARGE_TEMPLATE_SID,
  )

  const chargeWithContactTemplateSid = getOptionalEnv(
    'TWILIO_CHARGE_WITH_CONTACT_TEMPLATE_SID',
    DEFAULT_CHARGE_WITH_CONTACT_TEMPLATE_SID,
  )

  const selectedTemplateSid = contentVariables?.['6']
    ? chargeWithContactTemplateSid
    : chargeTemplateSid

  const body = new URLSearchParams()
  body.set('MessagingServiceSid', messagingServiceSid)
  body.set('To', to)

  if (supabaseUrl) {
    body.set('StatusCallback', `${supabaseUrl}/functions/v1/twilio-status-webhook`)
  }

  if (selectedTemplateSid && contentVariables) {
    body.set('ContentSid', selectedTemplateSid)
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

  return {
    ...data,
    selected_template_sid: selectedTemplateSid,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)
  }

  let supabase: any = null
  let chargeId: string | null = null
  let userId: string | null = null

  try {
    const body = await req.json().catch(() => ({}))

    chargeId = String(body.charge_id || '')
    userId = String(body.user_id || '')

    if (!chargeId || !userId) {
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

    supabase = createClient(supabaseUrl, serviceRoleKey)

    await logPlatformEvent({
      supabase,
      provider: 'twilio',
      eventType: 'manual_whatsapp_charge_requested',
      userId,
      relatedTable: 'charges',
      relatedId: chargeId,
      status: 'info',
      message: 'Solicitação de envio manual de cobrança por WhatsApp.',
      requestPayload: body,
    })

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
      .eq('id', chargeId)
      .eq('user_id', userId)
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

    const to = formatWhatsAppTo(getClientFromCharge(charge)?.phone)

    if (!to) {
      return jsonResponse(
        {
          ok: false,
          error: 'Cliente sem telefone válido.',
        },
        400,
      )
    }

    if (!charge.payment_url && !charge.pix_qr_code) {
      return jsonResponse(
        {
          ok: false,
          error: 'A cobrança ainda não possui Pix ou link de pagamento.',
        },
        400,
      )
    }

    const permission = await canSendMessageForUser(supabase, userId)

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

    const fallbackMessage = buildChargeWhatsAppMessage(charge)
    const templateVariables = buildChargeTemplateVariables(charge)

    const twilioMessage = await sendWithTwilio({
  to,
  text: fallbackMessage,
  contentVariables: templateVariables,
})

await incrementMessageUsage({
  supabase,
  userId,
  chargeId: charge.id,
})

await supabase
  .from('scheduled_messages')
  .update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    provider: 'twilio',
    provider_message_id: twilioMessage.sid,
    error_message: null,
    processing_started_at: null,
    last_attempt_at: new Date().toISOString(),
  })
  .eq('user_id', userId)
  .eq('charge_id', charge.id)
  .eq('status', 'pending')
  .lte('scheduled_for', new Date().toISOString())

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

    await logPlatformEvent({
      supabase,
      provider: 'twilio',
      eventType: 'manual_whatsapp_charge_sent',
      userId,
      relatedTable: 'charges',
      relatedId: charge.id,
      status: 'success',
      message: 'Cobrança enviada manualmente por WhatsApp usando template aprovado.',
      responsePayload: {
        sid: twilioMessage.sid,
        status: twilioMessage.status,
        to,
        content_sid: twilioMessage.selected_template_sid,
        has_support_contacts: Boolean(templateVariables['6']),
      },
    })

    return jsonResponse({
      ok: true,
      message_sid: twilioMessage.sid,
      status: twilioMessage.status,
      charge: updatedCharge || charge,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro ao enviar cobrança por WhatsApp.'

    console.error('Erro ao enviar cobrança por WhatsApp:', error)

    await logPlatformEvent({
      supabase,
      provider: 'twilio',
      eventType: 'manual_whatsapp_charge_error',
      userId,
      relatedTable: 'charges',
      relatedId: chargeId,
      status: 'error',
      message: 'Erro ao enviar cobrança por WhatsApp.',
      errorMessage,
    })

    return jsonResponse(
      {
        ok: false,
        error: errorMessage,
      },
      500,
    )
  }
})