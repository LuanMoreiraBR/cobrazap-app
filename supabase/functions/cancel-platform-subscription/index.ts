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
  eventType,
  userId = null,
  relatedId = null,
  status = 'info',
  message = '',
  requestPayload = {},
  responsePayload = {},
  errorMessage = null,
}: {
  supabase: any
  eventType: string
  userId?: string | null
  relatedId?: string | null
  status?: string
  message?: string
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  errorMessage?: string | null
}) {
  try {
    await supabase.from('platform_event_logs').insert({
      provider: 'mercado_pago',
      event_type: eventType,
      user_id: userId,
      related_table: 'user_subscriptions',
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

    if (!userId) {
      return jsonResponse(
        {
          ok: false,
          error: 'user_id é obrigatório.',
        },
        400,
      )
    }

    if (auth.user.id !== userId) {
      return jsonResponse(
        {
          ok: false,
          error: 'Você só pode cancelar a renovação da sua própria conta.',
        },
        403,
      )
    }

    const { data: subscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (subscriptionError) throw subscriptionError

    if (!subscription?.mercado_pago_preapproval_id) {
      return jsonResponse(
        {
          ok: false,
          error: 'Assinatura automática não encontrada.',
        },
        404,
      )
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/preapproval/${subscription.mercado_pago_preapproval_id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'cancelled',
        }),
      },
    )

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Erro ao cancelar assinatura Mercado Pago:', mpData)
      throw new Error(mpData?.message || 'Erro ao cancelar assinatura automática.')
    }

    const { data: updatedSubscription, error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        auto_renew: false,
        auto_renew_status: 'cancelled',
        auto_renew_cancelled_at: new Date().toISOString(),
        auto_renew_last_event_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    await logPlatformEvent({
      supabase,
      eventType: 'platform_auto_subscription_cancelled_by_user',
      userId,
      relatedId: subscription.id,
      status: 'success',
      message: 'Renovação automática cancelada pelo usuário.',
      requestPayload,
      responsePayload: {
        mercado_pago_preapproval_id: subscription.mercado_pago_preapproval_id,
        mercado_pago_status: mpData.status,
      },
    })

    return jsonResponse({
      ok: true,
      subscription: updatedSubscription,
      mercado_pago: mpData,
    })
  } catch (error) {
    console.error(error)

    await logPlatformEvent({
      supabase,
      eventType: 'platform_auto_subscription_cancel_error',
      status: 'error',
      message: 'Erro ao cancelar renovação automática.',
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