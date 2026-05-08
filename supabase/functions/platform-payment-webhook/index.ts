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

function getTwilioFrom() {
  return (
    Deno.env.get('TWILIO_WHATSAPP_FROM') ||
    Deno.env.get('TWILIO_FROM') ||
    ''
  )
}

function isUuid(value: string | null | undefined) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ''),
  )
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
      related_id: relatedId && isUuid(relatedId) ? relatedId : null,
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

async function getPaymentFromMercadoPago(paymentId: string, accessToken: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro ao buscar pagamento Mercado Pago:', data)
    throw new Error(data?.message || 'Erro ao buscar pagamento no Mercado Pago.')
  }

  return data
}

function getPaymentIdFromRequest(url: URL, body: any) {
  const queryDataId = url.searchParams.get('data.id')
  const queryId = url.searchParams.get('id')
  const queryResource = url.searchParams.get('resource')

  const bodyDataId = body?.data?.id
  const bodyId = body?.id
  const bodyResource = body?.resource

  const resource = String(queryResource || bodyResource || '')

  if (resource.includes('/v1/payments/')) {
    return resource.split('/v1/payments/')[1]
  }

  return String(queryDataId || bodyDataId || queryId || bodyId || '')
}

function getEventType(url: URL, body: any) {
  return String(
    body?.type ||
      body?.topic ||
      body?.action ||
      url.searchParams.get('type') ||
      url.searchParams.get('topic') ||
      '',
  )
}

function shouldIgnoreEventType(type: string) {
  if (!type) return false

  const normalized = type.toLowerCase()

  if (normalized.includes('payment')) return false

  return true
}

function getChargeIdFromPayment(payment: any) {
  return String(
    payment?.external_reference ||
      payment?.metadata?.charge_id ||
      payment?.additional_info?.external_reference ||
      '',
  )
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
  const from = getTwilioFrom()

  if (!accountSid || !authToken || !from) {
    console.warn('Twilio não configurado. Confirmação não enviada.', {
      hasAccountSid: Boolean(accountSid),
      hasAuthToken: Boolean(authToken),
      hasFrom: Boolean(from),
    })

    return {
      skipped: true,
      reason: 'Twilio não configurado.',
    }
  }

  if (!to) {
    console.warn('Telefone do cliente vazio. Confirmação não enviada.')

    return {
      skipped: true,
      reason: 'Telefone do cliente vazio.',
    }
  }

  const credentials = btoa(`${accountSid}:${authToken}`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: to,
        Body: body,
      }),
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
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  let supabase: any = null
  let requestPayload: Record<string, unknown> = {}
  let currentChargeId: string | null = null
  let currentUserId: string | null = null

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
    }

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    supabase = createClient(supabaseUrl, serviceRoleKey)

    const url = new URL(req.url)

    let body: any = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    requestPayload = {
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    }

    console.log('Webhook Mercado Pago recebido:', requestPayload)

    const eventType = getEventType(url, body)

    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'webhook_received',
      status: 'info',
      message: `Webhook Mercado Pago recebido: ${eventType || 'sem tipo'}.`,
      requestPayload,
    })

    if (shouldIgnoreEventType(eventType)) {
      await logPlatformEvent({
        supabase,
        provider: 'mercado_pago',
        eventType: 'webhook_ignored',
        status: 'ignored',
        message: `Evento ignorado: ${eventType}`,
        requestPayload,
      })

      return jsonResponse({
        ok: true,
        ignored: true,
        reason: `Evento ignorado: ${eventType}`,
      })
    }

    const paymentId = getPaymentIdFromRequest(url, body)

    if (!paymentId) {
      await logPlatformEvent({
        supabase,
        provider: 'mercado_pago',
        eventType: 'webhook_ignored',
        status: 'ignored',
        message: 'Webhook Mercado Pago sem paymentId.',
        requestPayload,
      })

      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Sem paymentId.',
      })
    }

    const payment = await getPaymentFromMercadoPago(paymentId, accessToken)
    const chargeId = getChargeIdFromPayment(payment)

    currentChargeId = chargeId || null

    if (!chargeId) {
      await logPlatformEvent({
        supabase,
        provider: 'mercado_pago',
        eventType: 'payment_without_charge_reference',
        status: 'ignored',
        message: 'Pagamento sem external_reference/charge_id.',
        requestPayload,
        responsePayload: {
          payment_id: payment.id,
          payment_status: payment.status,
        },
      })

      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Pagamento sem external_reference/charge_id.',
        payment_id: payment.id,
        payment_status: payment.status,
      })
    }

    const { data: chargeBeforeUpdate, error: chargeBeforeUpdateError } =
      await supabase
        .from('charges')
        .select(
          `
          id,
          user_id,
          client_id,
          description,
          amount,
          status,
          paid_at,
          payment_status,
          mercado_pago_payment_id,
          client:clients (
            id,
            name,
            phone
          )
        `,
        )
        .eq('id', chargeId)
        .maybeSingle()

    if (chargeBeforeUpdateError) throw chargeBeforeUpdateError

    if (!chargeBeforeUpdate) {
      await logPlatformEvent({
        supabase,
        provider: 'mercado_pago',
        eventType: 'payment_charge_not_found',
        status: 'ignored',
        message: 'Cobrança não encontrada para pagamento Mercado Pago.',
        relatedTable: 'charges',
        relatedId: chargeId,
        requestPayload,
        responsePayload: {
          payment_id: payment.id,
          payment_status: payment.status,
        },
      })

      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Cobrança não encontrada.',
        charge_id: chargeId,
        payment_id: payment.id,
      })
    }

    currentUserId = chargeBeforeUpdate.user_id

    const isApproved = payment.status === 'approved'
    const alreadyPaid = chargeBeforeUpdate.status === 'pago'

    if (isApproved && alreadyPaid) {
      console.log('Cobrança já estava paga. Ignorando confirmação duplicada.', {
        charge_id: chargeId,
        payment_id: payment.id,
      })

      await logPlatformEvent({
        supabase,
        provider: 'mercado_pago',
        eventType: 'payment_duplicate_ignored',
        userId: chargeBeforeUpdate.user_id,
        relatedTable: 'charges',
        relatedId: chargeId,
        status: 'ignored',
        message: 'Cobrança já estava paga. Confirmação duplicada ignorada.',
        requestPayload,
        responsePayload: {
          payment_id: payment.id,
          payment_status: payment.status,
        },
      })

      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Cobrança já estava paga. Confirmação não reenviada.',
        charge_id: chargeId,
        payment_id: payment.id,
        payment_status: payment.status,
      })
    }

    const { error: updateChargeError } = await supabase
      .from('charges')
      .update({
        payment_provider: 'mercado_pago',
        payment_id: String(payment.id),
        payment_status: payment.status,
        mercado_pago_payment_id: String(payment.id),
        status: isApproved ? 'pago' : chargeBeforeUpdate.status,
        paid_at: isApproved
          ? chargeBeforeUpdate.paid_at || new Date().toISOString()
          : chargeBeforeUpdate.paid_at,
      })
      .eq('id', chargeId)

    if (updateChargeError) throw updateChargeError

    let processedEventInserted = false

    if (isApproved) {
      const { error: processedEventError } = await supabase
        .from('processed_payment_events')
        .insert({
          provider: 'mercado_pago',
          payment_id: String(payment.id),
          charge_id: chargeId,
          event_status: payment.status,
        })

      if (processedEventError) {
        if (String(processedEventError.code) === '23505') {
          console.log('Evento Mercado Pago já processado. Ignorando duplicado.', {
            charge_id: chargeId,
            payment_id: payment.id,
            payment_status: payment.status,
          })

          await logPlatformEvent({
            supabase,
            provider: 'mercado_pago',
            eventType: 'payment_duplicate_event_ignored',
            userId: chargeBeforeUpdate.user_id,
            relatedTable: 'charges',
            relatedId: chargeId,
            status: 'ignored',
            message: 'Evento Mercado Pago já processado anteriormente.',
            requestPayload,
            responsePayload: {
              payment_id: payment.id,
              payment_status: payment.status,
            },
          })

          return jsonResponse({
            ok: true,
            ignored: true,
            reason: 'Evento já processado anteriormente. Confirmação não reenviada.',
            charge_id: chargeId,
            payment_id: payment.id,
            payment_status: payment.status,
          })
        }

        throw processedEventError
      }

      processedEventInserted = true
    }

    let twilioResult: any = null

    if (isApproved && processedEventInserted) {
      const { error: scheduledError } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'cancelled',
          error_message: 'Cobrança paga via Mercado Pago.',
        })
        .eq('charge_id', chargeId)
        .eq('status', 'pending')

      if (scheduledError) throw scheduledError

      const client = Array.isArray(chargeBeforeUpdate.client)
        ? chargeBeforeUpdate.client[0]
        : chargeBeforeUpdate.client

      const to = formatWhatsAppTo(client?.phone)
      const confirmationMessage = buildPaymentConfirmationMessage({
        clientName: client?.name || 'cliente',
        description: chargeBeforeUpdate.description || 'cobrança',
        amount: chargeBeforeUpdate.amount || 0,
      })

      twilioResult = await sendTwilioWhatsAppMessage({
        to,
        body: confirmationMessage,
      })

      await logPlatformEvent({
        supabase,
        provider: 'twilio',
        eventType: twilioResult?.skipped
          ? 'payment_confirmation_whatsapp_skipped'
          : 'payment_confirmation_whatsapp_sent',
        userId: chargeBeforeUpdate.user_id,
        relatedTable: 'charges',
        relatedId: chargeId,
        status: twilioResult?.skipped ? 'ignored' : 'success',
        message: twilioResult?.skipped
          ? twilioResult.reason || 'Confirmação WhatsApp não enviada.'
          : 'Confirmação de pagamento enviada por WhatsApp.',
        requestPayload: {
          charge_id: chargeId,
          payment_id: payment.id,
          to,
        },
        responsePayload: twilioResult || {},
      })
    }

    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: isApproved ? 'payment_approved' : 'payment_updated',
      userId: chargeBeforeUpdate.user_id,
      relatedTable: 'charges',
      relatedId: chargeId,
      status: isApproved ? 'success' : 'info',
      message: isApproved
        ? 'Pagamento aprovado e cobrança atualizada.'
        : `Pagamento atualizado com status ${payment.status}.`,
      requestPayload,
      responsePayload: {
        payment_id: payment.id,
        payment_status: payment.status,
        charge_status: isApproved ? 'pago' : chargeBeforeUpdate.status,
        confirmation_sent: Boolean(
          isApproved &&
            processedEventInserted &&
            twilioResult &&
            !twilioResult.skipped,
        ),
        twilio: twilioResult,
      },
    })

    return jsonResponse({
      ok: true,
      charge_id: chargeId,
      payment_id: payment.id,
      payment_status: payment.status,
      charge_status: isApproved ? 'pago' : chargeBeforeUpdate.status,
      confirmation_sent: Boolean(
        isApproved &&
          processedEventInserted &&
          twilioResult &&
          !twilioResult.skipped,
      ),
      twilio: twilioResult,
    })
  } catch (error) {
    console.error(error)

    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'webhook_processing_error',
      userId: currentUserId,
      relatedTable: currentChargeId ? 'charges' : null,
      relatedId: currentChargeId,
      status: 'error',
      message: 'Erro ao processar webhook Mercado Pago.',
      requestPayload,
      errorMessage: error instanceof Error ? error.message : 'Erro inesperado.',
    })

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado.',
      },
      500,
    )
  }
})