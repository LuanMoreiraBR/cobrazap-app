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
const FREE_TRIAL_MESSAGE_LIMIT = 10

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

  if (typeof error === 'string') return error

  try {
    return JSON.stringify(error)
  } catch {
    return String(error || 'Erro desconhecido')
  }
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

function getClientFromMessage(message: any) {
  return Array.isArray(message?.client) ? message.client[0] : message?.client
}

function getChargeFromMessage(message: any) {
  return Array.isArray(message?.charge) ? message.charge[0] : message?.charge
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

  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:platform_plans (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (subscriptionError) throw subscriptionError

  const subscription = subscriptions?.[0] || null

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

async function callSendChargeWhatsapp({
  chargeId,
  userId,
  authorizationHeader,
}: {
  chargeId: string
  userId: string
  authorizationHeader: string
}) {
  const supabaseUrl = getEnv('SUPABASE_URL').replace(/\/$/, '')

  const response = await fetch(
    `${supabaseUrl}/functions/v1/send-charge-whatsapp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorizationHeader,
      },
      body: JSON.stringify({
        charge_id: chargeId,
        user_id: userId,
      }),
    },
  )

  const responseText = await response.text()

  let data: any = null

  try {
    data = responseText ? JSON.parse(responseText) : null
  } catch {
    data = {
      raw_response: responseText,
    }
  }

  if (!response.ok) {
    throw new Error(
      `send-charge-whatsapp retornou HTTP ${response.status}: ${JSON.stringify(data)}`,
    )
  }

  if (data?.ok === false) {
    throw new Error(
      `send-charge-whatsapp retornou ok=false: ${JSON.stringify(data)}`,
    )
  }

  return data || {}
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authorizationHeader = req.headers.get('authorization')

  if (!authorizationHeader) {
    return jsonResponse(
      {
        ok: false,
        error: 'Authorization header ausente.',
      },
      401,
    )
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
      reason: `Fora do horário permitido. Envio permitido somente de segunda a sexta, das ${BUSINESS_START_HOUR}:00 às ${BUSINESS_END_HOUR}:00, horário de Brasília.`,
      business_time: businessTime,
      allowed_days: 'Segunda a sexta',
      allowed_hours: `${BUSINESS_START_HOUR}:00-${BUSINESS_END_HOUR}:00`,
      timezone: BUSINESS_TIME_ZONE,
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
    const { data: messages, error } = await supabase
      .from('scheduled_messages')
      .select(
        `
        *,
        charge:charges (
          id,
          user_id,
          status,
          payment_status,
          description,
          amount,
          due_date,
          payment_url,
          pix_qr_code,
          payment_type,
          support_whatsapp_contacts,
          installment_number,
          installment_total,
          recurrence_type,
          recurrence_number,
          recurrence_total,
          credit_card_enabled
        ),
        client:clients (
          id,
          name,
          phone
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
          error: getErrorMessage(error),
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
              processing_started_at: null,
            })
            .eq('id', message.id)
            .eq('status', 'pending')

          results.push({
            id: message.id,
            user_id: message.user_id,
            charge_id: message.charge_id,
            client_id: message.client_id,
            status: 'failed',
            reason: `Limite de tentativas atingido: ${maxAttempts}.`,
          })

          continue
        }

        const { data: lockedMessage, error: lockError } = await supabase
          .from('scheduled_messages')
          .update({
            provider: 'twilio',
            processing_started_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            attempts: currentAttempts + 1,
          })
          .eq('id', message.id)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()

        if (lockError) throw lockError

        if (!lockedMessage) {
          results.push({
            id: message.id,
            user_id: message.user_id,
            charge_id: message.charge_id,
            client_id: message.client_id,
            status: 'skipped',
            reason: 'Mensagem já estava sendo processada por outra execução.',
          })

          continue
        }

        const charge = getChargeFromMessage(message)
        const client = getClientFromMessage(message)

        if (!charge) {
          throw new Error('Cobrança não encontrada para a mensagem agendada.')
        }

        if (!client) {
          throw new Error('Cliente não encontrado para a mensagem agendada.')
        }

        if (charge?.status === 'pago') {
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
            client_id: message.client_id,
            status: 'cancelled',
            reason: 'Cobrança já paga.',
          })

          continue
        }

        if (!charge?.payment_url && !charge?.pix_qr_code) {
          throw new Error('A cobrança ainda não possui Pix ou link de pagamento.')
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

        const sendResult = await callSendChargeWhatsapp({
          chargeId: message.charge_id,
          userId: message.user_id,
          authorizationHeader,
        })

        const providerMessageId =
          sendResult?.message_sid ||
          sendResult?.sid ||
          sendResult?.provider_message_id ||
          sendResult?.twilio_sid ||
          null

        await supabase
          .from('scheduled_messages')
          .update({
            status: 'sent',
            provider: 'twilio',
            provider_message_id: providerMessageId,
            error_message: null,
            sent_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            processing_started_at: null,
          })
          .eq('id', message.id)

        await logPlatformEvent({
          supabase,
          provider: 'twilio',
          eventType: 'scheduled_whatsapp_charge_sent',
          userId: message.user_id,
          relatedTable: 'scheduled_messages',
          relatedId: message.id,
          status: 'success',
          message:
            'Mensagem agendada enviada por WhatsApp usando send-charge-whatsapp.',
          requestPayload: {
            charge_id: message.charge_id,
            user_id: message.user_id,
            client_id: message.client_id,
          },
          responsePayload: sendResult,
        })

        results.push({
          id: message.id,
          user_id: message.user_id,
          charge_id: message.charge_id,
          client_id: message.client_id,
          status: 'sent',
          provider: 'twilio',
          provider_message_id: providerMessageId,
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

        await logPlatformEvent({
          supabase,
          provider: 'twilio',
          eventType: 'scheduled_whatsapp_charge_error',
          userId: message.user_id,
          relatedTable: 'scheduled_messages',
          relatedId: message.id,
          status: 'error',
          message: 'Erro ao enviar mensagem agendada por WhatsApp.',
          requestPayload: {
            charge_id: message.charge_id,
            user_id: message.user_id,
            client_id: message.client_id,
          },
          responsePayload: {},
          errorMessage,
        })

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
