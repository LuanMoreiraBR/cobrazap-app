import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUSINESS_TIME_ZONE = 'America/Sao_Paulo'
const BUSINESS_START_HOUR = 8
const BUSINESS_END_HOUR = 22
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

function getSupportContactsTextFromMessage(message: any) {
  const charge = getChargeFromMessage(message)

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

function buildChargeTemplateVariables(message: any) {
  const charge = getChargeFromMessage(message)
  const client = getClientFromMessage(message)
  const supportContactsText = getSupportContactsTextFromMessage(message)

  const variables: Record<string, string> = {
    '1': String(client?.name || 'cliente'),
    '2': cleanDescription(charge?.description || message?.message_text),
    '3': formatCurrencyBRL(charge?.amount),
    '4': formatDateBR(charge?.due_date),
    '5': String(charge?.payment_url || ''),
  }

  if (supportContactsText) {
    variables['6'] = supportContactsText
  }

  return variables
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
        ? `Limite mensal de mensagens atingido: ${messagesSent}/${totalMessageLimit}.`
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

        if (lockError) throw lockError

        if (!lockedMessage) {
          results.push({
            id: message.id,
            user_id: message.user_id,
            status: 'skipped',
            reason: 'Mensagem já estava sendo processada por outra execução.',
          })

          continue
        }

        const charge = getChargeFromMessage(message)
        const client = getClientFromMessage(message)

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

        const to = formatBrazilWhatsApp(client?.phone || message.phone)
        const text = String(message.message_text || '').trim()

        if (!text) {
          throw new Error('Mensagem vazia.')
        }

        const templateVariables = buildChargeTemplateVariables(message)

        const twilioResult = await sendWithTwilio({
          to,
          text,
          contentVariables: templateVariables,
        })

        await incrementMessageUsage({
          supabase,
          userId: message.user_id,
          messageId: message.id,
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

        await logPlatformEvent({
          supabase,
          provider: 'twilio',
          eventType: 'scheduled_whatsapp_charge_sent',
          userId: message.user_id,
          relatedTable: 'scheduled_messages',
          relatedId: message.id,
          status: 'success',
          message: 'Mensagem agendada enviada por WhatsApp usando template aprovado.',
          responsePayload: {
            sid: twilioResult.sid,
            status: twilioResult.status,
            to,
            charge_id: message.charge_id,
            client_id: message.client_id,
            content_sid: twilioResult.selected_template_sid,
            has_support_contacts: Boolean(templateVariables['6']),
          },
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
          content_sid: twilioResult.selected_template_sid,
          has_support_contacts: Boolean(templateVariables['6']),
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
          errorMessage,
          responsePayload: {
            charge_id: message.charge_id,
            client_id: message.client_id,
          },
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