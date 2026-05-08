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

function isSubscriptionCurrentlyActive(subscription: any) {
  if (!subscription) return false
  if (subscription.status !== 'active') return false
  if (!subscription.current_period_end) return true

  return new Date(subscription.current_period_end) > new Date()
}

async function getAuthenticatedUser(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  if (!jwt) {
    return {
      user: null,
      error: 'Usuário não autenticado.',
      status: 401,
    }
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt)

  if (error || !user) {
    return {
      user: null,
      error: 'Sessão inválida.',
      status: 401,
    }
  }

  return {
    user,
    error: null,
    status: 200,
  }
}

async function logPlatformEvent({
  supabase,
  provider = 'mercado_pago',
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
  provider?: string
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

  let supabase: any = null
  let requestPayload: Record<string, unknown> = {}

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

    const auth = await getAuthenticatedUser(req, supabase)

    if (auth.error) {
      return jsonResponse(
        {
          ok: false,
          error: auth.error,
        },
        auth.status,
      )
    }

    const body = await req.json().catch(() => ({}))
    requestPayload = body

    const userId = String(body.user_id || '')
    const planId = String(body.plan_id || '')

    if (!userId || !planId) {
      return jsonResponse(
        {
          ok: false,
          error: 'user_id e plan_id são obrigatórios.',
        },
        400,
      )
    }

    if (auth.user.id !== userId) {
      return jsonResponse(
        {
          ok: false,
          error: 'Você só pode ativar renovação automática para sua própria conta.',
        },
        403,
      )
    }

    const { data: plan, error: planError } = await supabase
      .from('platform_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError) throw planError
    if (!plan) throw new Error('Plano não encontrado.')

    const { data: existingSubscription, error: subscriptionError } =
      await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

    if (subscriptionError) throw subscriptionError

    const isCurrentlyActive = isSubscriptionCurrentlyActive(existingSubscription)

    let subscription = existingSubscription

    if (!subscription) {
      const { data: insertedSubscription, error: insertError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: plan.id,
          status: 'pending',
          auto_renew: false,
          auto_renew_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (insertError) throw insertError

      subscription = insertedSubscription
    } else {
      const { data: updatedSubscription, error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          plan_id: isCurrentlyActive ? subscription.plan_id : plan.id,
          auto_renew_status: 'pending',
          auto_renew_cancelled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)
        .select('*')
        .single()

      if (updateError) throw updateError

      subscription = updatedSubscription
    }

    const {
      data: { user: authUser },
      error: adminUserError,
    } = await supabase.auth.admin.getUserById(userId)

    if (adminUserError) throw adminUserError

    const payerEmail = authUser?.email || auth.user.email

    if (!payerEmail) {
      throw new Error('E-mail do usuário não encontrado para criar assinatura.')
    }

    const appUrl = getBaseAppUrl()

    const preapprovalBody = {
      reason: `Plano ${plan.name} - Lembrei`,
      external_reference: subscription.id,
      payer_email: payerEmail,
      back_url: `${appUrl}/app/plano?auto_renew=return`,
      notification_url: getNotificationUrl(),
      status: 'pending',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: Number(plan.price),
        currency_id: 'BRL',
      },
      metadata: {
        type: 'platform_auto_subscription',
        user_id: userId,
        plan_id: plan.id,
        subscription_id: subscription.id,
      },
    }

    const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preapprovalBody),
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago preapproval:', mpData)
      throw new Error(mpData?.message || 'Erro ao criar assinatura automática.')
    }

    const preapprovalId = String(mpData.id || '')
    const initPoint = mpData.init_point || mpData.sandbox_init_point || null

    if (!preapprovalId || !initPoint) {
      throw new Error('Mercado Pago não retornou link da assinatura.')
    }

    const { data: finalSubscription, error: finalUpdateError } = await supabase
      .from('user_subscriptions')
      .update({
        mercado_pago_preapproval_id: preapprovalId,
        mercado_pago_preapproval_url: initPoint,
        auto_renew: false,
        auto_renew_status: 'pending',
        auto_renew_last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select('*')
      .single()

    if (finalUpdateError) throw finalUpdateError

    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'platform_auto_subscription_created',
      userId,
      relatedTable: 'user_subscriptions',
      relatedId: subscription.id,
      status: 'success',
      message: 'Link de assinatura automática criado.',
      requestPayload,
      responsePayload: {
        preapproval_id: preapprovalId,
        init_point: initPoint,
        plan_id: plan.id,
        amount: plan.price,
      },
    })

    return jsonResponse({
      ok: true,
      subscription: finalSubscription,
      preapproval_id: preapprovalId,
      init_point: initPoint,
      payment_url: initPoint,
    })
  } catch (error) {
    console.error(error)

    await logPlatformEvent({
      supabase,
      provider: 'mercado_pago',
      eventType: 'platform_auto_subscription_create_error',
      status: 'error',
      message: 'Erro ao criar assinatura automática.',
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