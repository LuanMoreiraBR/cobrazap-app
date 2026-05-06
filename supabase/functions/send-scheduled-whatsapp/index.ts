import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'
const BUSINESS_START_HOUR = 8
const BUSINESS_END_HOUR = 18

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
    throw new Error(`Variável de ambiente ausente: ${name}`)
  }

  return value
}

function getOptionalEnv(name: string, fallback = '') {
  return Deno.env.get(name) || fallback
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error || 'Erro desconhecido')
}

function onlyDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function formatBrazilWhatsApp(phone: string | null | undefined) {
  const digits = onlyDigits(phone)

  if (!digits) {
    throw new Error('Telefone vazio.')
  }

  if (digits.startsWith('55')) {
    return `whatsapp:+${digits}`
  }

  return `whatsapp:+55${digits}`
}

function getBatchLimit() {
  const value = Number(getOptionalEnv('SCHEDULED_WHATSAPP_BATCH_LIMIT', '50'))

  if (!value || value <= 0) return 50
  if (value > 100) return 100

  return value
}

function getMaxAttempts() {
  const value = Number(getOptionalEnv('SCHEDULED_WHATSAPP_MAX_ATTEMPTS', '3'))

  if (!value || value <= 0) return 3
  if (value > 10) return 10

  return value
}

function getBrazilBusinessTime() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const weekday = parts.find((part) => part.type === 'weekday')?.value || ''
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)

  const isWeekday = !['Sat', 'Sun'].includes(weekday)
  const isBusinessHour = hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR

  return {
    timezone: BUSINESS_TIME_ZONE,
    weekday,
    hour,
    minute,
    isWeekday,
    isBusinessHour,
    canSend: isWeekday && isBusinessHour,
  }
}

async function canSendMessageForUser(supabase: any, userId: string) {
  const yearMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)

  const { data: subscription, error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:platform_plans (*)
    `)
    .eq('user_id', userId)
    .maybeSingle()

  if (subscriptionError) throw subscriptionError

  if (!subscription || subscription.status !== 'active') {
    return {
      allowed: false,
      reason: 'Usuário sem assinatura ativa.',
    }
  }

  if (
    subscription.current_period_end &&
    new Date(subscription.current_period_end) <= new Date()
  ) {
    return {
      allowed: false,
      reason: 'Assinatura expirada.',
    }
  }

  const maxMessages = subscription.plan?.max_messages_per_month

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

  if (messagesSent >= Number(maxMessages)) {
    return {
      allowed: false,
      reason: `Limite mensal de mensagens atingido: ${messagesSent}/${maxMessages}.`,
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
  messageId,
}: {
  supabase: any
  userId: string
  messageId: string
}) {
  const { error } = await supabase.rpc('increment_user_message_usage', {
    p_user_id: userId,
    p_source_table: 'scheduled_messages',
    p_source_id: messageId,
  })

  if (error) {
    console.error('Erro ao contabilizar uso mensal:', error)
    throw error
  }
}

async function sendWithTwilio({ to, text }: { to: string; text: string }) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = getEnv('TWILIO_MESSAGING_SERVICE_SID')

  const body = new URLSearchParams()
  body.set('MessagingServiceSid', messagingServiceSid)
  body.set('To', to)
  body.set('Body', text)

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
    return jsonResponse(
      {
        ok: false,
        error: 'Método não permitido. Use POST.',
      },
      405,
    )
  }

  const businessTime = getBrazilBusinessTime()

  if (!businessTime.canSend) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason:
        'Fora do horário permitido. Envio permitido somente de segunda a sexta, das 08:00 às 18:00, horário de Brasília.',
      business_time: businessTime,
    })
  }

  const supabase = createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const nowIso = new Date().toISOString()
  const batchLimit = getBatchLimit()
  const maxAttempts = getMaxAttempts()

  const results: Array<Record<string, unknown>> = []

  try {
    const staleProcessingDate = new Date(
      Date.now() - 15 * 60 * 1000,
    ).toISOString()

    await supabase
      .from('scheduled_messages')
      .update({
        status: 'pending',
        error_message:
          'Envio voltou para pendente porque ficou preso em processamento.',
        processing_started_at: null,
      })
      .eq('status', 'processing')
      .lt('processing_started_at', staleProcessingDate)

    const { data: messages, error } = await supabase
      .from('scheduled_messages')
      .select(
        `
        *,
        charge:charges (
          id,
          status,
          payment_status
        )
      `,
      )
      .eq('status', 'pending')
      .lte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true })
      .limit(batchLimit)

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500,
      )
    }

    for (const message of messages || []) {
      const currentAttempts = Number(message.attempts || 0)

      try {
        if (currentAttempts >= maxAttempts) {
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: `Limite de tentativas atingido: ${maxAttempts}.`,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', message.id)
            .eq('status', 'pending')

          results.push({
            id: message.id,
            user_id: message.user_id,
            status: 'failed',
            reason: `Limite de tentativas atingido: ${maxAttempts}.`,
          })

          continue
        }

        const { data: lockedMessage, error: lockError } = await supabase
          .from('scheduled_messages')
          .update({
            status: 'processing',
            processing_started_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            attempts: currentAttempts + 1,
          })
          .eq('id', message.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

        if (lockError) {
          throw lockError
        }

        if (!lockedMessage) {
          results.push({
            id: message.id,
            user_id: message.user_id,
            status: 'skipped',
            reason: 'Mensagem já estava sendo processada por outra execução.',
          })

          continue
        }

        if (message.charge?.status === 'pago') {
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'cancelled',
              error_message: 'Cobrança já paga.',
              last_attempt_at: new Date().toISOString(),
              processing_started_at: null,
            })
            .eq('id', message.id)

          results.push({
            id: message.id,
            user_id: message.user_id,
            charge_id: message.charge_id,
            status: 'cancelled',
            reason: 'Cobrança já paga.',
          })

          continue
        }

        const permission = await canSendMessageForUser(supabase, message.user_id)

        if (!permission.allowed) {
          await supabase
            .from('scheduled_messages')
            .update({
              status: 'failed',
              error_message: permission.reason,
              last_attempt_at: new Date().toISOString(),
              processing_started_at: null,
            })
            .eq('id', message.id)

          results.push({
            id: message.id,
            user_id: message.user_id,
            charge_id: message.charge_id,
            client_id: message.client_id,
            status: 'failed',
            error: permission.reason,
          })

          continue
        }

        const to = formatBrazilWhatsApp(message.phone)
        const text = String(message.message_text || '').trim()

        if (!text) {
          throw new Error('Mensagem vazia.')
        }

        const twilioResult = await sendWithTwilio({
          to,
          text,
        })

        await supabase
          .from('scheduled_messages')
          .update({
            status: 'sent',
            provider: 'twilio',
            provider_message_id: twilioResult.sid,
            error_message: null,
            sent_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            processing_started_at: null,
          })
          .eq('id', message.id)

        await incrementMessageUsage({
          supabase,
          userId: message.user_id,
          messageId: message.id,
        })

        results.push({
          id: message.id,
          user_id: message.user_id,
          charge_id: message.charge_id,
          client_id: message.client_id,
          status: 'sent',
          to,
          provider: 'twilio',
          provider_message_id: twilioResult.sid,
        })
      } catch (err) {
        const errorMessage = getErrorMessage(err)

        await supabase
          .from('scheduled_messages')
          .update({
            status: 'failed',
            error_message: errorMessage,
            last_attempt_at: new Date().toISOString(),
            processing_started_at: null,
          })
          .eq('id', message.id)

        results.push({
          id: message.id,
          user_id: message.user_id,
          charge_id: message.charge_id,
          client_id: message.client_id,
          status: 'failed',
          error: errorMessage,
        })
      }
    }

    return jsonResponse({
      ok: true,
      business_time: businessTime,
      allowed_days: 'Segunda a sexta',
      allowed_hours: `${BUSINESS_START_HOUR}:00-${BUSINESS_END_HOUR}:00`,
      timezone: BUSINESS_TIME_ZONE,
      found: messages?.length || 0,
      sent: results.filter((item) => item.status === 'sent').length,
      cancelled: results.filter((item) => item.status === 'cancelled').length,
      failed: results.filter((item) => item.status === 'failed').length,
      skipped: results.filter((item) => item.status === 'skipped').length,
      results,
    })
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: getErrorMessage(err),
      },
      500,
    )
  }
})