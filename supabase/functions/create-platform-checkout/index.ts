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

function getBaseAppUrl() {
  return (
    Deno.env.get('APP_URL') ||
    Deno.env.get('SITE_URL') ||
    'https://seu-site.vercel.app'
  )
}

function getNotificationUrl() {
  const customUrl = Deno.env.get('MERCADO_PAGO_PLATFORM_WEBHOOK_URL')

  if (customUrl) return customUrl

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  return `${supabaseUrl}/functions/v1/platform-payment-webhook`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const { user_id, plan_id, installments = 1 } = await req.json()

    if (!user_id || !plan_id) {
      return jsonResponse(
        {
          ok: false,
          error: 'user_id e plan_id são obrigatórios.',
        },
        400,
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: plan, error: planError } = await supabase
      .from('platform_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single()

    if (planError) throw planError
    if (!plan) throw new Error('Plano não encontrado.')

    const appUrl = getBaseAppUrl()

    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert(
        {
          user_id,
          plan_id: plan.id,
          status: 'pending',
          selected_installments: Number(installments || 1),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      )
      .select('*')
      .single()

    if (subscriptionError) throw subscriptionError

    const { data: paymentRow, error: paymentRowError } = await supabase
      .from('platform_subscription_payments')
      .insert({
        user_id,
        subscription_id: subscription.id,
        plan_id: plan.id,
        amount: plan.price,
        status: 'pending',
        checkout_type: 'checkout_pro',
      })
      .select('*')
      .single()

    if (paymentRowError) throw paymentRowError

    const preferenceBody = {
      items: [
        {
          id: plan.id,
          title: `Plano ${plan.name} - Lembrei`,
          description: plan.description || `Assinatura mensal do plano ${plan.name}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(plan.price),
        },
      ],
      external_reference: paymentRow.id,
      notification_url: getNotificationUrl(),
      back_urls: {
        success: `${appUrl}/app/assinatura?payment=success`,
        pending: `${appUrl}/app/assinatura?payment=pending`,
        failure: `${appUrl}/app/assinatura?payment=failure`,
      },
      auto_return: 'approved',
      payment_methods: {
        installments: Math.max(1, Math.min(Number(installments || 1), 12)),
        default_installments: Math.max(1, Math.min(Number(installments || 1), 12)),
        excluded_payment_types: [],
        excluded_payment_methods: [],
      },
      metadata: {
        type: 'platform_subscription',
        user_id,
        plan_id: plan.id,
        subscription_id: subscription.id,
        platform_payment_id: paymentRow.id,
      },
    }

    const mpResponse = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferenceBody),
      },
    )

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago assinatura plataforma:', mpData)
      throw new Error(mpData?.message || 'Erro ao criar checkout do plano.')
    }

    const paymentUrl = mpData.init_point || mpData.sandbox_init_point || null
    const preferenceId = String(mpData.id)

    const { data: updatedPayment, error: updatePaymentError } = await supabase
      .from('platform_subscription_payments')
      .update({
        mercado_pago_preference_id: preferenceId,
        payment_url: paymentUrl,
      })
      .eq('id', paymentRow.id)
      .select('*')
      .single()

    if (updatePaymentError) throw updatePaymentError

    const { data: updatedSubscription, error: updateSubscriptionError } =
      await supabase
        .from('user_subscriptions')
        .update({
          mercado_pago_preference_id: preferenceId,
          payment_url: paymentUrl,
          selected_installments: Number(installments || 1),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)
        .select('*')
        .single()

    if (updateSubscriptionError) throw updateSubscriptionError

    return jsonResponse({
      ok: true,
      plan,
      subscription: updatedSubscription,
      payment: updatedPayment,
      payment_url: paymentUrl,
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