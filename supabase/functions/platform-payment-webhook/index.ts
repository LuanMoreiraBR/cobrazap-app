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

function addOneMonth() {
  const now = new Date()
  const next = new Date(now)
  next.setMonth(next.getMonth() + 1)
  return next.toISOString()
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

function getExternalReference(payment: any) {
  return String(
    payment?.external_reference ||
      payment?.metadata?.external_reference ||
      payment?.metadata?.platform_payment_id ||
      payment?.metadata?.message_credit_purchase_id ||
      payment?.metadata?.charge_id ||
      '',
  )
}

function getPaymentPreferenceId(payment: any) {
  return String(
    payment?.preference_id ||
      payment?.metadata?.preference_id ||
      payment?.metadata?.mercado_pago_preference_id ||
      '',
  )
}

async function getPaymentFromMercadoPago(paymentId: string, accessToken: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
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

async function processPlatformSubscriptionPayment({
  supabase,
  payment,
  requestPayload,
}: {
  supabase: any
  payment: any
  requestPayload: Record<string, unknown>
}) {
  const externalReference = getExternalReference(payment)
  const preferenceId = getPaymentPreferenceId(payment)
  const paymentId = String(payment.id)
  const isApproved = payment.status === 'approved'

  let query = supabase
    .from('platform_subscription_payments')
    .select('*')

  if (externalReference) {
    query = query.eq('id', externalReference)
  } else if (preferenceId) {
    query = query.eq('mercado_pago_preference_id', preferenceId)
  } else {
    return {
      handled: false,
      reason: 'Sem external_reference/preference_id para pagamento de plano.',
    }
  }

  const { data: paymentRow, error } = await query.maybeSingle()

  if (error) throw error

  if (!paymentRow) {
    return {
      handled: false,
      reason: 'Pagamento não encontrado em platform_subscription_payments.',
    }
  }

  await supabase
    .from('platform_subscription_payments')
    .update({
      status: isApproved ? 'paid' : payment.status,
      mercado_pago_payment_id: paymentId,
      paid_at: isApproved ? paymentRow.paid_at || new Date().toISOString() : paymentRow.paid_at,
    })
    .eq('id', paymentRow.id)

  if (isApproved) {
    const periodStart = new Date().toISOString()
    const periodEnd = addOneMonth()

    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        plan_id: paymentRow.plan_id,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        mercado_pago_payment_id: paymentId,
        last_payment_status: payment.status,
        activated_at: paymentRow.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRow.subscription_id)

    if (subscriptionError) throw subscriptionError
  }

  await logPlatformEvent({
    supabase,
    provider: 'mercado_pago',
    eventType: isApproved
      ? 'platform_subscription_payment_approved'
      : 'platform_subscription_payment_updated',
    userId: paymentRow.user_id,
    relatedTable: 'platform_subscription_payments',
    relatedId: paymentRow.id,
    status: isApproved ? 'success' : 'info',
    message: isApproved
      ? 'Pagamento de plano aprovado e assinatura ativada.'
      : `Pagamento de plano atualizado com status ${payment.status}.`,
    requestPayload,
    responsePayload: {
      payment_id: paymentId,
      payment_status: payment.status,
      payment_row_id: paymentRow.id,
      subscription_id: paymentRow.subscription_id,
      plan_id: paymentRow.plan_id,
      preference_id: preferenceId,
      external_reference: externalReference,
    },
  })

  return {
    handled: true,
    type: 'platform_subscription',
    payment_row_id: paymentRow.id,
    subscription_id: paymentRow.subscription_id,
    user_id: paymentRow.user_id,
    approved: isApproved,
  }
}

async function processMessageCreditPurchase({
  supabase,
  payment,
  requestPayload,
}: {
  supabase: any
  payment: any
  requestPayload: Record<string, unknown>
}) {
  const externalReference = getExternalReference(payment)
  const preferenceId = getPaymentPreferenceId(payment)
  const paymentId = String(payment.id)
  const isApproved = payment.status === 'approved'

  let query = supabase
    .from('message_credit_purchases')
    .select('*')

  if (externalReference) {
    query = query.eq('id', externalReference)
  } else if (preferenceId) {
    query = query.eq('mercado_pago_preference_id', preferenceId)
  } else {
    return {
      handled: false,
      reason: 'Sem external_reference/preference_id para compra de créditos.',
    }
  }

  const { data: purchase, error } = await query.maybeSingle()

  if (error) throw error

  if (!purchase) {
    return {
      handled: false,
      reason: 'Compra não encontrada em message_credit_purchases.',
    }
  }

  await supabase
    .from('message_credit_purchases')
    .update({
      status: isApproved ? 'paid' : payment.status,
      remaining: isApproved ? purchase.quantity : purchase.remaining,
      provider_payment_id: paymentId,
      paid_at: isApproved ? purchase.paid_at || new Date().toISOString() : purchase.paid_at,
    })
    .eq('id', purchase.id)

  await logPlatformEvent({
    supabase,
    provider: 'mercado_pago',
    eventType: isApproved
      ? 'message_credit_purchase_approved'
      : 'message_credit_purchase_updated',
    userId: purchase.user_id,
    relatedTable: 'message_credit_purchases',
    relatedId: purchase.id,
    status: isApproved ? 'success' : 'info',
    message: isApproved
      ? 'Compra de créditos aprovada.'
      : `Compra de créditos atualizada com status ${payment.status}.`,
    requestPayload,
    responsePayload: {
      payment_id: paymentId,
      payment_status: payment.status,
      purchase_id: purchase.id,
      quantity: purchase.quantity,
      preference_id: preferenceId,
      external_reference: externalReference,
    },
  })

  return {
    handled: true,
    type: 'message_credit_purchase',
    purchase_id: purchase.id,
    user_id: purchase.user_id,
    approved: isApproved,
  }
}

async function processChargePayment({
  supabase,
  payment,
  requestPayload,
}: {
  supabase: any
  payment: any
  requestPayload: Record<string, unknown>
}) {
  const externalReference = getExternalReference(payment)
  const paymentId = String(payment.id)
  const isApproved = payment.status === 'approved'

  if (!externalReference) {
    return {
      handled: false,
      reason: 'Sem external_reference para cobrança.',
    }
  }

  const { data: charge, error } = await supabase
    .from('charges')
    .select('*')
    .eq('id', externalReference)
    .maybeSingle()

  if (error) throw error

  if (!charge) {
    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'payment_charge_not_found',
      status: 'ignored',
      message: 'Cobrança não encontrada para pagamento Mercado Pago.',
      requestPayload,
      responsePayload: {
        payment_id: paymentId,
        payment_status: payment.status,
        external_reference: externalReference,
      },
    })

    return {
      handled: false,
      reason: 'Cobrança não encontrada em charges.',
    }
  }

  await supabase
    .from('charges')
    .update({
      payment_provider: 'mercado_pago',
      payment_id: paymentId,
      payment_status: payment.status,
      mercado_pago_payment_id: paymentId,
      status: isApproved ? 'pago' : charge.status,
      paid_at: isApproved ? charge.paid_at || new Date().toISOString() : charge.paid_at,
    })
    .eq('id', charge.id)

  if (isApproved) {
    await supabase
      .from('scheduled_messages')
      .update({
        status: 'cancelled',
        error_message: 'Cobrança paga via Mercado Pago.',
      })
      .eq('charge_id', charge.id)
      .eq('status', 'pending')
  }

  await logPlatformEvent({
    supabase,
    provider: 'mercado_pago',
    eventType: isApproved ? 'charge_payment_approved' : 'charge_payment_updated',
    userId: charge.user_id,
    relatedTable: 'charges',
    relatedId: charge.id,
    status: isApproved ? 'success' : 'info',
    message: isApproved
      ? 'Pagamento de cobrança aprovado.'
      : `Pagamento de cobrança atualizado com status ${payment.status}.`,
    requestPayload,
    responsePayload: {
      payment_id: paymentId,
      payment_status: payment.status,
      charge_id: charge.id,
      external_reference: externalReference,
    },
  })

  return {
    handled: true,
    type: 'charge',
    charge_id: charge.id,
    user_id: charge.user_id,
    approved: isApproved,
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

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
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

    const subscriptionResult = await processPlatformSubscriptionPayment({
      supabase,
      payment,
      requestPayload,
    })

    if (subscriptionResult.handled) {
      return jsonResponse({
        ok: true,
        ...subscriptionResult,
        payment_status: payment.status,
      })
    }

    const creditResult = await processMessageCreditPurchase({
      supabase,
      payment,
      requestPayload,
    })

    if (creditResult.handled) {
      return jsonResponse({
        ok: true,
        ...creditResult,
        payment_status: payment.status,
      })
    }

    const chargeResult = await processChargePayment({
      supabase,
      payment,
      requestPayload,
    })

    if (chargeResult.handled) {
      return jsonResponse({
        ok: true,
        ...chargeResult,
        payment_status: payment.status,
      })
    }

    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'payment_not_recognized',
      status: 'ignored',
      message: 'Pagamento Mercado Pago não reconhecido como plano, crédito ou cobrança.',
      requestPayload,
      responsePayload: {
        payment_id: payment.id,
        payment_status: payment.status,
        external_reference: getExternalReference(payment),
        preference_id: getPaymentPreferenceId(payment),
        subscription_reason: subscriptionResult.reason,
        credit_reason: creditResult.reason,
        charge_reason: chargeResult.reason,
      },
    })

    return jsonResponse({
      ok: true,
      ignored: true,
      reason: 'Pagamento não reconhecido.',
      payment_id: payment.id,
      payment_status: payment.status,
    })
  } catch (error) {
    console.error(error)

    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'webhook_processing_error',
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