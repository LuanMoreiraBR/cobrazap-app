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
    .trim()
}

function buildChargeTemplateVariables(message: any) {
  const charge = Array.isArray(message?.charge)
    ? message.charge[0]
    : message?.charge

  const client = Array.isArray(message?.client)
    ? message.client[0]
    : message?.client

  return {
    '1': client?.name || 'cliente',
    '2': cleanDescription(charge?.description),
    '3': formatCurrencyBRL(charge?.amount),
    '4': formatDateBR(charge?.due_date),
    '5': charge?.payment_url || '',
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

  const hasActivePlan =
    subscription?.status === 'active' &&
    (!subscription.current_period_end ||
      new Date(subscription.current_period_end) > new Date())

  const baseMessageLimit = hasActivePlan
    ? Number(subscription.plan?.max_messages_per_month || 0)
    : FREE_TRIAL_MESSAGE_LIMIT

  if (!baseMessageLimit) {
    return {
      allowed: true,
      reason: 'Plano ilimitado.',
    }
  }

  const extraCredits = hasActivePlan
    ? await getExtraMessageCredits(supabase, userId)
    : 0

  const totalMessageLimit = baseMessageLimit + extraCredits

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
        ? `Limite mensal de mensagens atingido: ${messagesSent}/${totalMessageLimit}.`
        : `Usuário usou as ${FREE_TRIAL_MESSAGE_LIMIT} mensagens grátis.`,
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
  const { error } = await supabase.rpc('register_message_usage_with_credits', {
    p_user_id: userId,
    p_source_table: 'scheduled_messages',
    p_source_id: messageId,
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
    return jsonResponse(
      {
        ok: false,
        error: 'Método não permitido. Use POST.',
      },
      405,
    )
  }

  let supabase: any = null
  const results: Array<Record<string, unknown>> = []

  try {
    const businessTime = getBrazilBusinessTime()

    supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    if (!businessTime.canSend) {
      await logPlatformEvent({
        supabase,
        provider: 'twilio',
        eventType: 'scheduled_whatsapp_batch_skipped',
        status: 'ignored',
        message:
          'Fora do horário permitido. Envio permitido somente de segunda a sexta, das 08:00 às 18:00.',
        requestPayload: {
          business_time: businessTime,
        },
      })

      return jsonResponse({
        ok: true,
        skipped: true,
        reason:
          'Fora do horário permitido. Envio permitido somente de segunda a sexta, das 08:00 às 18:00, horário de Brasília.',
        business_time: businessTime,
      })
    }

    const nowIso = new Date().toISOString()
    const batchLimit = getBatchLimit()
    const maxAttempts = getMaxAttempts()

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
          payment_status,
          description,
          due_date,
          amount,
          payment_url
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
      await logPlatformEvent({
        supabase,
        provider: 'twilio',
        eventType: 'scheduled_whatsapp_batch_failed',
        status: 'error',
        message: 'Erro ao buscar mensagens agendadas.',
        requestPayload: {
          batch_limit: batchLimit,
          max_attempts: maxAttempts,
          business_time: businessTime,
        },
        errorMessage: error.message,
      })

      return jsonResponse(
        {
          ok: false,
          error: error.message,
        },
        500,
      )
    }

    await logPlatformEvent({
      supabase,
      provider: 'twilio',
      eventType: 'scheduled_whatsapp_batch_started',
      status: 'info',
      message: 'Processamento de mensagens agendadas iniciado.',
      requestPayload: {
        batch_limit: batchLimit,
        max_attempts: maxAttempts,
        found: messages?.length || 0,
        business_time: businessTime,
      },
    })

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
            status: 'failed',
            reason: `Limite de tentativas atingido: ${maxAttempts}.`,
          })

          await logPlatformEvent({
            supabase,
            provider: 'twilio',
            eventType: 'scheduled_whatsapp_failed',
            userId: message.user_id,
            relatedTable: 'scheduled_messages',
            relatedId: message.id,
            status: 'error',
            message: `Limite de tentativas atingido: ${maxAttempts}.`,
            requestPayload: {
              message_id: message.id,
              charge_id: message.charge_id,
              attempts: currentAttempts,
              max_attempts: maxAttempts,
            },
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

          await logPlatformEvent({
            supabase,
            provider: 'twilio',
            eventType: 'scheduled_whatsapp_skipped',
            userId: message.user_id,
            relatedTable: 'scheduled_messages',
            relatedId: message.id,
            status: 'ignored',
            message: 'Mensagem já estava sendo processada por outra execução.',
            requestPayload: {
              message_id: message.id,
              charge_id: message.charge_id,
              client_id: message.client_id,
            },
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

          await logPlatformEvent({
            supabase,
            provider: 'twilio',
            eventType: 'scheduled_whatsapp_cancelled',
            userId: message.user_id,
            relatedTable: 'scheduled_messages',
            relatedId: message.id,
            status: 'ignored',
            message: 'Mensagem cancelada porque a cobrança já estava paga.',
            requestPayload: {
              message_id: message.id,
              charge_id: message.charge_id,
            },
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

          await logPlatformEvent({
            supabase,
            provider: 'twilio',
            eventType: 'scheduled_whatsapp_blocked_by_billing',
            userId: message.user_id,
            relatedTable: 'scheduled_messages',
            relatedId: message.id,
            status: 'ignored',
            message: permission.reason,
            requestPayload: {
              message_id: message.id,
              charge_id: message.charge_id,
              client_id: message.client_id,
            },
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
          contentVariables: buildChargeTemplateVariables(message),
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

        await logPlatformEvent({
          supabase,
          provider: 'twilio',
          eventType: 'scheduled_whatsapp_sent',
          userId: message.user_id,
          relatedTable: 'scheduled_messages',
          relatedId: message.id,
          status: 'success',
          message: 'Mensagem agendada enviada com sucesso.',
          requestPayload: {
            message_id: message.id,
            charge_id: message.charge_id,
            client_id: message.client_id,
            to,
          },
          responsePayload: {
            sid: twilioResult.sid,
            status: twilioResult.status || null,
          },
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

        await logPlatformEvent({
          supabase,
          provider: 'twilio',
          eventType: 'scheduled_whatsapp_failed',
          userId: message.user_id,
          relatedTable: 'scheduled_messages',
          relatedId: message.id,
          status: 'error',
          message: 'Falha ao enviar mensagem agendada.',
          requestPayload: {
            message_id: message.id,
            charge_id: message.charge_id,
            client_id: message.client_id,
          },
          errorMessage,
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
    const errorMessage = getErrorMessage(err)

    await logPlatformEvent({
      supabase,
      provider: 'twilio',
      eventType: 'scheduled_whatsapp_batch_failed',
      status: 'error',
      message: 'Erro geral ao processar mensagens agendadas.',
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