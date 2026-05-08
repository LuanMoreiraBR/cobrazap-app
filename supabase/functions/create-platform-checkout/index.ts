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

function normalizeInstallments(value: unknown) {
  const installments = Number(value || 1)

  if (!Number.isFinite(installments)) return 1

  return Math.max(1, Math.min(installments, 12))
}

function isSubscriptionCurrentlyActive(subscription: any) {
  if (!subscription) return false
  if (subscription.status !== 'active') return false

  if (!subscription.current_period_end) return true

  return new Date(subscription.current_period_end) > new Date()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        error: 'Método não permitido.',
      },
      405,
    )
  }

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

    const body = await req.json().catch(() => ({}))

    const userId = String(body.user_id || '')
    const planId = String(body.plan_id || '')
    const installments = normalizeInstallments(body.installments)

    if (!userId || !planId) {
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
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError) throw planError
    if (!plan) throw new Error('Plano não encontrado.')

    const { data: existingSubscription, error: existingSubscriptionError } =
      await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

    if (existingSubscriptionError) throw existingSubscriptionError

    const isCurrentlyActive =
      isSubscriptionCurrentlyActive(existingSubscription)

    let subscription = existingSubscription

    if (!subscription) {
      const { data: insertedSubscription, error: insertSubscriptionError } =
        await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            plan_id: plan.id,
            status: 'pending',
            current_period_start: null,
            current_period_end: null,
            mercado_pago_payment_id: null,
            mercado_pago_preference_id: null,
            payment_url: null,
            payment_method: null,
            selected_installments: installments,
            last_payment_status: null,
            activated_at: null,
            cancelled_at: null,
            updated_at: new Date().toISOString(),
          })
          .select('*')
          .single()

      if (insertSubscriptionError) throw insertSubscriptionError

      subscription = insertedSubscription
    } else if (isCurrentlyActive) {
      const { data: updatedSubscription, error: updateSubscriptionError } =
        await supabase
          .from('user_subscriptions')
          .update({
            selected_installments: installments,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)
          .select('*')
          .single()

      if (updateSubscriptionError) throw updateSubscriptionError

      subscription = updatedSubscription
    } else {
      const { data: updatedSubscription, error: updateSubscriptionError } =
        await supabase
          .from('user_subscriptions')
          .update({
            plan_id: plan.id,
            status: 'pending',
            current_period_start: null,
            current_period_end: null,
            mercado_pago_payment_id: null,
            mercado_pago_preference_id: null,
            payment_url: null,
            payment_method: null,
            selected_installments: installments,
            last_payment_status: null,
            activated_at: null,
            cancelled_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)
          .select('*')
          .single()

      if (updateSubscriptionError) throw updateSubscriptionError

      subscription = updatedSubscription
    }

    const { data: paymentRow, error: paymentRowError } = await supabase
      .from('platform_subscription_payments')
      .insert({
        user_id: userId,
        subscription_id: subscription.id,
        plan_id: plan.id,
        amount: plan.price,
        status: 'pending',
        checkout_type: 'checkout_pro',
      })
      .select('*')
      .single()

    if (paymentRowError) throw paymentRowError

    const appUrl = getBaseAppUrl()

    const preferenceBody = {
      items: [
        {
          id: plan.id,
          title: `Plano ${plan.name} - Lembrei`,
          description:
            plan.description || `Assinatura mensal do plano ${plan.name}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(plan.price),
        },
      ],

      external_reference: paymentRow.id,

      notification_url: getNotificationUrl(),

      back_urls: {
        success: `${appUrl}/app?payment=success`,
        pending: `${appUrl}/app?payment=pending`,
        failure: `${appUrl}/planos?payment=failure`,
      },

      auto_return: 'approved',

      payment_methods: {
        installments,
        default_installments: installments,
        excluded_payment_types: [],
        excluded_payment_methods: [],
      },

      metadata: {
        type: 'platform_subscription',
        checkout_type: 'platform_subscription',
        user_id: userId,
        plan_id: plan.id,
        subscription_id: subscription.id,
        platform_payment_id: paymentRow.id,
        platform_subscription_payment_id: paymentRow.id,
        is_renewal: isCurrentlyActive,
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
    const preferenceId = String(mpData.id || '')

    if (!preferenceId) {
      throw new Error('Mercado Pago não retornou preference_id.')
    }

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
          selected_installments: installments,
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
      preference_id: preferenceId,
      is_renewal: isCurrentlyActive,
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