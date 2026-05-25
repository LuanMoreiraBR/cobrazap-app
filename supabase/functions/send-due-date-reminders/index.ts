import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'
const FREE_TRIAL_MESSAGE_LIMIT = 10

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável ausente: ${name}`)
  return value
}

function getOptionalEnv(name: string, fallback = '') {
  return Deno.env.get(name) || fallback
}

function getTodayBrazil() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getCurrentYearMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

function onlyDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function formatWhatsAppTo(phone: string | null | undefined) {
  const digits = onlyDigits(phone)
  if (!digits) return ''
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `whatsapp:+${withCountry}`
}

function formatCurrencyBRL(amount: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(amount || 0),
  )
}

function formatDateBR(dateString: string | null | undefined) {
  if (!dateString) return '-'
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${dateString}T00:00:00`))
}

function cleanDescription(description: string | null | undefined) {
  return String(description || 'cobrança')
    .replace(/\s*-\s*Parcela\s+\d+\/\d+$/i, '')
    .replace(/\s*-\s*Recorrência\s+\d+\/\d+$/i, '')
    .trim()
}

function buildDueDateMessage(charge: any) {
  const clientName = charge.client?.name || 'cliente'
  const description = cleanDescription(charge.description)
  const amount = formatCurrencyBRL(charge.amount)
  const dueDate = formatDateBR(charge.due_date)

  const paymentPart = charge.payment_url
    ? `Para pagar, acesse o link seguro:\n${charge.payment_url}`
    : charge.pix_qr_code
      ? `Pix copia e cola:\n${charge.pix_qr_code}`
      : 'Entre em contato com o cobrador para obter o link de pagamento.'

  return `Olá ${clientName}! 👋

Hoje é o dia do vencimento da sua cobrança referente a *${description}*, no valor de *${amount}* (vencimento: ${dueDate}).

Se ainda não pagou, aproveite para regularizar hoje:
${paymentPart}

Após pagar, responda PAGO nesta conversa para consultar a confirmação.`
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

  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('*, plan:platform_plans (*)')
    .eq('user_id', userId)
    .maybeSingle()

  const hasPeriodEnd = Boolean(subscription?.current_period_end)
  const periodExpired =
    hasPeriodEnd && new Date(subscription.current_period_end) <= new Date()

  if (subscription && periodExpired && Number(subscription?.plan?.price ?? 0) > 0) {
    return { allowed: false }
  }

  const hasActivePlan = subscription?.status === 'active' && !periodExpired
  const planMessageLimit = hasActivePlan
    ? Number(subscription?.plan?.max_messages_per_month || 0)
    : FREE_TRIAL_MESSAGE_LIMIT

  const extraCredits = await getExtraMessageCredits(supabase, userId)
  const totalMessageLimit = planMessageLimit + extraCredits

  if (!totalMessageLimit) return { allowed: true }

  const { data: usage } = await supabase
    .from('user_monthly_usage')
    .select('messages_sent')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle()

  const messagesSent = Number(usage?.messages_sent || 0)

  return { allowed: messagesSent < totalMessageLimit }
}

async function sendWithTwilio(to: string, body: string) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = getEnv('TWILIO_MESSAGING_SERVICE_SID')
  const supabaseUrl = getOptionalEnv('SUPABASE_URL').replace(/\/$/, '')

  const params = new URLSearchParams()
  params.set('MessagingServiceSid', messagingServiceSid)
  params.set('To', to)
  params.set('Body', body)

  if (supabaseUrl) {
    params.set('StatusCallback', `${supabaseUrl}/functions/v1/twilio-status-webhook`)
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
      body: params,
    },
  )

  const data = await response.json()

  if (!response.ok) throw new Error(`Twilio error: ${JSON.stringify(data)}`)

  return data
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = getEnv('SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const today = getTodayBrazil()

    // Buscar cobranças com vencimento hoje, não pagas, com cliente e pagamento gerado
    const { data: charges, error: chargesError } = await supabase
      .from('charges')
      .select(`
        id,
        user_id,
        description,
        amount,
        due_date,
        status,
        payment_url,
        pix_qr_code,
        client:clients (id, name, phone)
      `)
      .eq('due_date', today)
      .neq('status', 'pago')
      .not('client', 'is', null)

    if (chargesError) throw chargesError

    if (!charges || charges.length === 0) {
      return jsonResponse({ ok: true, processed: 0, reason: 'Nenhuma cobrança vencendo hoje.' })
    }

    // Filtrar apenas cobranças com link/pix gerado e telefone válido
    const eligible = charges.filter((charge: any) => {
      const client = Array.isArray(charge.client) ? charge.client[0] : charge.client
      const hasPhone = onlyDigits(client?.phone).length >= 10
      const hasPayment = charge.payment_url || charge.pix_qr_code
      return hasPhone && hasPayment
    })

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const charge of eligible) {
      try {
        const client = Array.isArray(charge.client) ? charge.client[0] : charge.client

        // Verificar se já enviou lembrete de vencimento hoje para essa cobrança
        const { data: existing } = await supabase
          .from('platform_event_logs')
          .select('id')
          .eq('event_type', 'due_date_reminder_sent')
          .eq('related_id', charge.id)
          .gte('created_at', `${today}T00:00:00`)
          .maybeSingle()

        if (existing) {
          skipped++
          continue
        }

        // Verificar se o usuário pode enviar
        const permission = await canSendMessageForUser(supabase, charge.user_id)
        if (!permission.allowed) {
          skipped++
          continue
        }

        const to = formatWhatsAppTo(client.phone)
        const messageText = buildDueDateMessage({ ...charge, client })

        const twilioResult = await sendWithTwilio(to, messageText)

        // Contabilizar uso
        await supabase.rpc('register_message_usage_with_credits', {
          p_user_id: charge.user_id,
          p_source_table: 'charges',
          p_source_id: charge.id,
        })

        // Registrar envio para deduplicação
        await supabase.from('platform_event_logs').insert({
          provider: 'twilio',
          event_type: 'due_date_reminder_sent',
          user_id: charge.user_id,
          related_table: 'charges',
          related_id: charge.id,
          status: 'success',
          message: `Lembrete de vencimento enviado para ${client.name}.`,
          response_payload: { sid: twilioResult.sid, to },
        })

        sent++
      } catch (err) {
        console.error(`Erro ao processar cobrança ${charge.id}:`, err)
        failed++
      }
    }

    return jsonResponse({ ok: true, today, total: eligible.length, sent, skipped, failed })
  } catch (error) {
    console.error('Erro send-due-date-reminders:', error)
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'Erro inesperado.' },
      500,
    )
  }
})
