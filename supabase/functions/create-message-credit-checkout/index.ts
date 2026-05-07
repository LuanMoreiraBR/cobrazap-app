import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ALLOWED_PACKAGES = [50, 100, 250]

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
  return new Response('ok', {
    status: 200,
    headers: corsHeaders,
  })
}

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const { user_id, quantity, installments = 1 } = await req.json()

    if (!user_id) {
      return jsonResponse({ ok: false, error: 'user_id é obrigatório.' }, 400)
    }

    const packageQuantity = Number(quantity || 0)

    if (!ALLOWED_PACKAGES.includes(packageQuantity)) {
      return jsonResponse(
        {
          ok: false,
          error: 'Pacote inválido. Use 50, 100 ou 250 mensagens.',
        },
        400,
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:platform_plans (*)
      `)
      .eq('user_id', user_id)
      .maybeSingle()

    if (subscriptionError) throw subscriptionError

    const hasActivePlan =
      subscription?.status === 'active' &&
      (!subscription.current_period_end ||
        new Date(subscription.current_period_end) > new Date())

    if (!hasActivePlan) {
      return jsonResponse(
        {
          ok: false,
          error: 'Créditos extras estão disponíveis apenas para usuários com plano ativo.',
        },
        402,
      )
    }

    const plan = subscription.plan
    const unitPrice = Number(plan?.extra_message_price || 0)

    if (!unitPrice || unitPrice <= 0) {
      throw new Error('Preço de mensagem extra não configurado para este plano.')
    }

    const amount = Number((packageQuantity * unitPrice).toFixed(2))
    const appUrl = getBaseAppUrl()

    const { data: purchase, error: purchaseError } = await supabase
      .from('message_credit_purchases')
      .insert({
        user_id,
        plan_id: plan.id,
        quantity: packageQuantity,
        remaining: 0,
        unit_price: unitPrice,
        amount,
        provider: 'mercado_pago',
        status: 'pending',
        checkout_type: 'message_credits',
      })
      .select('*')
      .single()

    if (purchaseError) throw purchaseError

    const preferenceBody = {
      items: [
        {
          id: `messages-${packageQuantity}`,
          title: `${packageQuantity} mensagens extras - Lembrei`,
          description: `Pacote de ${packageQuantity} mensagens extras para o plano ${plan.name}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amount,
        },
      ],
      external_reference: purchase.id,
      notification_url: getNotificationUrl(),
      back_urls: {
        success: `${appUrl}/app?credits=success`,
        pending: `${appUrl}/app?credits=pending`,
        failure: `${appUrl}/app?credits=failure`,
      },
      auto_return: 'approved',
      payment_methods: {
        installments: Math.max(1, Math.min(Number(installments || 1), 12)),
        default_installments: Math.max(1, Math.min(Number(installments || 1), 12)),
        excluded_payment_types: [],
        excluded_payment_methods: [],
      },
      metadata: {
        type: 'message_credits',
        user_id,
        plan_id: plan.id,
        purchase_id: purchase.id,
        quantity: packageQuantity,
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
      console.error('Erro Mercado Pago créditos:', mpData)
      throw new Error(mpData?.message || 'Erro ao criar checkout de créditos.')
    }

    const paymentUrl = mpData.init_point || mpData.sandbox_init_point || null
    const preferenceId = String(mpData.id)

    const { data: updatedPurchase, error: updateError } = await supabase
      .from('message_credit_purchases')
      .update({
        mercado_pago_preference_id: preferenceId,
        payment_url: paymentUrl,
      })
      .eq('id', purchase.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    return jsonResponse({
      ok: true,
      purchase: updatedPurchase,
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