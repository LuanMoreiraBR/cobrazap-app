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

function addOneMonthFrom(date: Date) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next.toISOString()
}

function getRenewalPeriod(subscription: any) {
  const now = new Date()

  const currentEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null

  const hasFuturePeriod = currentEnd && currentEnd > now

  const periodStart = hasFuturePeriod
    ? subscription.current_period_start || now.toISOString()
    : now.toISOString()

  const baseForEnd = hasFuturePeriod ? currentEnd : now

  const periodEnd = addOneMonthFrom(baseForEnd)

  return {
    periodStart,
    periodEnd,
    wasRenewal: Boolean(hasFuturePeriod),
  }
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
  const { data: currentSubscription, error: currentSubscriptionError } =
    await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', paymentRow.subscription_id)
      .maybeSingle()

  if (currentSubscriptionError) throw currentSubscriptionError

  const { periodStart, periodEnd, wasRenewal } =
    getRenewalPeriod(currentSubscription)

  const { error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .update({
      status: 'active',
      plan_id: paymentRow.plan_id,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      mercado_pago_payment_id: paymentId,
      last_payment_status: payment.status,
      activated_at:
        currentSubscription?.activated_at ||
        paymentRow.paid_at ||
        new Date().toISOString(),
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentRow.subscription_id)

  if (subscriptionError) throw subscriptionError

  await logPlatformEvent({
    supabase,
    provider: 'mercado_pago',
    eventType: wasRenewal
      ? 'platform_subscription_renewed'
      : 'platform_subscription_activated',
    userId: paymentRow.user_id,
    relatedTable: 'user_subscriptions',
    relatedId: paymentRow.subscription_id,
    status: 'success',
    message: wasRenewal
      ? 'Assinatura renovada e período estendido.'
      : 'Assinatura ativada após pagamento aprovado.',
    requestPayload,
    responsePayload: {
      payment_id: paymentId,
      plan_id: paymentRow.plan_id,
      period_start: periodStart,
      period_end: periodEnd,
      was_renewal: wasRenewal,
    },
  })
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

function getPreapprovalIdFromRequest(url: URL, body: any) {
  const queryDataId = url.searchParams.get('data.id')
  const queryId = url.searchParams.get('id')
  const queryResource = url.searchParams.get('resource')

  const bodyDataId = body?.data?.id
  const bodyId = body?.id
  const bodyResource = body?.resource

  const resource = String(queryResource || bodyResource || '')

  if (resource.includes('/preapproval/')) {
    return resource.split('/preapproval/')[1]
  }

  return String(queryDataId || bodyDataId || queryId || bodyId || '')
}

function isPreapprovalEvent(eventType: string, body: any) {
  const normalized = String(eventType || '').toLowerCase()
  const topic = String(body?.topic || body?.type || '').toLowerCase()
  const resource = String(body?.resource || '').toLowerCase()

  return (
    normalized.includes('preapproval') ||
    topic.includes('preapproval') ||
    resource.includes('/preapproval/')
  )
}

async function getPreapprovalFromMercadoPago(
  preapprovalId: string,
  accessToken: string,
) {
  const response = await fetch(
    `https://api.mercadopago.com/preapproval/${preapprovalId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro ao buscar preapproval Mercado Pago:', data)
    throw new Error(data?.message || 'Erro ao buscar assinatura no Mercado Pago.')
  }

  return data
}

function getPeriodAfterAutoSubscriptionAuthorization(subscription: any) {
  const now = new Date()

  const currentEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null

  const hasFuturePeriod = currentEnd && currentEnd > now

  return {
    periodStart: hasFuturePeriod
      ? subscription.current_period_start || now.toISOString()
      : now.toISOString(),
    periodEnd: addOneMonthFrom(hasFuturePeriod ? currentEnd : now),
  }
}

async function processPreapprovalWebhook({
  supabase,
  accessToken,
  url,
  body,
  requestPayload,
}: {
  supabase: any
  accessToken: string
  url: URL
  body: any
  requestPayload: Record<string, unknown>
}) {
  const preapprovalId = getPreapprovalIdFromRequest(url, body)

  if (!preapprovalId) {
    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'preapproval_webhook_without_id',
      status: 'ignored',
      message: 'Webhook de assinatura sem preapprovalId.',
      requestPayload,
    })

    return {
      handled: true,
      ignored: true,
      reason: 'Sem preapprovalId.',
    }
  }

  const preapproval = await getPreapprovalFromMercadoPago(
    preapprovalId,
    accessToken,
  )

  const externalReference = String(preapproval.external_reference || '')
  const status = String(preapproval.status || '')

  let query = supabase
    .from('user_subscriptions')
    .select('*')

  if (externalReference) {
    query = query.eq('id', externalReference)
  } else {
    query = query.eq('mercado_pago_preapproval_id', preapprovalId)
  }

  const { data: subscription, error: subscriptionError } =
    await query.maybeSingle()

  if (subscriptionError) throw subscriptionError

  if (!subscription) {
    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'preapproval_subscription_not_found',
      status: 'ignored',
      message: 'Assinatura local não encontrada para preapproval Mercado Pago.',
      requestPayload,
      responsePayload: {
        preapproval_id: preapprovalId,
        preapproval_status: status,
        external_reference: externalReference,
      },
    })

    return {
      handled: true,
      ignored: true,
      reason: 'Assinatura local não encontrada.',
    }
  }

  const updatePayload: Record<string, unknown> = {
    mercado_pago_preapproval_id: preapprovalId,
    auto_renew_status: status,
    auto_renew_last_event_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (status === 'authorized') {
    const { periodStart, periodEnd } =
      getPeriodAfterAutoSubscriptionAuthorization(subscription)

    updatePayload.auto_renew = true
    updatePayload.status = 'active'
    updatePayload.current_period_start = periodStart
    updatePayload.current_period_end = periodEnd
    updatePayload.activated_at =
      subscription.activated_at || new Date().toISOString()
    updatePayload.cancelled_at = null
    updatePayload.auto_renew_started_at =
      subscription.auto_renew_started_at || new Date().toISOString()
    updatePayload.auto_renew_cancelled_at = null
  }

  if (['cancelled', 'paused'].includes(status)) {
    updatePayload.auto_renew = false
    updatePayload.auto_renew_cancelled_at = new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('user_subscriptions')
    .update(updatePayload)
    .eq('id', subscription.id)

  if (updateError) throw updateError

  await logPlatformEvent({
    supabase,
    provider: 'mercado_pago',
    eventType:
      status === 'authorized'
        ? 'platform_auto_subscription_authorized'
        : 'platform_auto_subscription_updated',
    userId: subscription.user_id,
    relatedTable: 'user_subscriptions',
    relatedId: subscription.id,
    status: status === 'authorized' ? 'success' : 'info',
    message:
      status === 'authorized'
        ? 'Renovação automática autorizada no Mercado Pago.'
        : `Assinatura automática atualizada com status ${status}.`,
    requestPayload,
    responsePayload: {
      preapproval_id: preapprovalId,
      preapproval_status: status,
      external_reference: externalReference,
      update_payload: updatePayload,
    },
  })

  return {
    handled: true,
    type: 'preapproval',
    preapproval_id: preapprovalId,
    preapproval_status: status,
    subscription_id: subscription.id,
    user_id: subscription.user_id,
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

    const isPreapproval = isPreapprovalEvent(eventType, body)

  if (!isPreapproval && shouldIgnoreEventType(eventType)) {
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

    if (isPreapproval) {
  const preapprovalResult = await processPreapprovalWebhook({
    supabase,
    accessToken,
    url,
    body,
    requestPayload,
  })

  return jsonResponse({
    ok: true,
    ...preapprovalResult,
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