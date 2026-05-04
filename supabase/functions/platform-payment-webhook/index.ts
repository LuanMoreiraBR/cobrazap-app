import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
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
    console.error('Erro ao buscar pagamento:', data)
    throw new Error(data?.message || 'Erro ao buscar pagamento Mercado Pago.')
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

function addOneMonth() {
  const now = new Date()
  const next = new Date(now)
  next.setMonth(next.getMonth() + 1)
  return next.toISOString()
}

serve(async (req) => {
  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const url = new URL(req.url)

    let body: any = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const paymentId = getPaymentIdFromRequest(url, body)

    if (!paymentId) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Sem paymentId.',
      })
    }

    const payment = await getPaymentFromMercadoPago(paymentId, accessToken)

    const platformPaymentId =
      payment.external_reference ||
      payment.metadata?.platform_payment_id ||
      ''

    if (!platformPaymentId) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Pagamento não é de assinatura da plataforma.',
      })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: paymentRow, error: paymentRowError } = await supabase
      .from('platform_subscription_payments')
      .select('*')
      .eq('id', platformPaymentId)
      .single()

    if (paymentRowError) throw paymentRowError
    if (!paymentRow) throw new Error('Pagamento da plataforma não encontrado.')

    const isApproved = payment.status === 'approved'

    await supabase
      .from('platform_subscription_payments')
      .update({
        status: payment.status,
        mercado_pago_payment_id: String(payment.id),
        paid_at: isApproved ? new Date().toISOString() : paymentRow.paid_at,
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
          mercado_pago_payment_id: String(payment.id),
          last_payment_status: payment.status,
          activated_at: paymentRow.paid_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentRow.subscription_id)

      if (subscriptionError) throw subscriptionError
    }

    return jsonResponse({
      ok: true,
      platform_payment_id: platformPaymentId,
      payment_status: payment.status,
      subscription_activated: isApproved,
    })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado.',
      },
      500,
    )
  }
})