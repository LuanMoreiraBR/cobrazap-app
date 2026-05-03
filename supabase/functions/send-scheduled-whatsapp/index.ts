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

function getBusinessHourNow() {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)

  return {
    hour,
    minute,
    isBusinessHour:
      hour >= BUSINESS_START_HOUR && hour < BUSINESS_END_HOUR,
  }
}

async function sendWithTwilio({ to, text }: { to: string; text: string }) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const from = getEnv('TWILIO_WHATSAPP_FROM')

  const body = new URLSearchParams()
  body.set('From', from)
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

  const businessTime = getBusinessHourNow()

  if (!businessTime.isBusinessHour) {
    return jsonResponse({
      ok: true,
      skipped: true,
      reason: `Fora do horário permitido. Envio permitido somente das ${BUSINESS_START_HOUR}:00 às ${BUSINESS_END_HOUR}:00, horário de Brasília.`,
      timezone: BUSINESS_TIME_ZONE,
      current_hour: businessTime.hour,
      current_minute: businessTime.minute,
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
      timezone: BUSINESS_TIME_ZONE,
      business_hours: `${BUSINESS_START_HOUR}:00-${BUSINESS_END_HOUR}:00`,
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