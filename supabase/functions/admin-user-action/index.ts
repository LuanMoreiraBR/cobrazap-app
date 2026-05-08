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

function addDays(days: number) {
  const now = new Date()
  const next = new Date(now)
  next.setDate(next.getDate() + days)
  return next.toISOString()
}

async function getAuthenticatedAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  if (!jwt) {
    throw new Error('Usuário não autenticado.')
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt)

  if (userError || !user) {
    throw new Error('Sessão inválida.')
  }

  const { data: admin, error: adminError } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) throw adminError

  if (!admin) {
    throw new Error('Acesso negado. Usuário não é admin.')
  }

  return {
    user,
    admin,
  }
}

async function logAdminAction({
  supabase,
  adminUserId,
  targetUserId,
  action,
  payload,
}: {
  supabase: any
  adminUserId: string
  targetUserId?: string
  action: string
  payload?: Record<string, unknown>
}) {
  const { error } = await supabase.from('platform_admin_actions').insert({
    admin_user_id: adminUserId,
    target_user_id: targetUserId || null,
    action,
    payload: payload || {},
  })

  if (error) {
    console.error('Erro ao registrar ação admin:', error)
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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { user: adminUser } = await getAuthenticatedAdmin(req, supabase)

    const body = await req.json()

    const action = String(body.action || '')
    const targetUserId = String(body.target_user_id || '')

    if (!action) {
      return jsonResponse(
        {
          ok: false,
          error: 'Ação obrigatória.',
        },
        400,
      )
    }

    if (!targetUserId) {
      return jsonResponse(
        {
          ok: false,
          error: 'target_user_id é obrigatório.',
        },
        400,
      )
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('app_user_profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (targetProfileError) throw targetProfileError

    if (!targetProfile) {
      return jsonResponse(
        {
          ok: false,
          error: 'Usuário alvo não encontrado.',
        },
        404,
      )
    }

    if (action === 'ADD_CREDITS') {
      const quantity = Number(body.quantity || 0)
      const note = String(body.note || 'Crédito manual adicionado pelo admin.')

      if (!quantity || quantity <= 0) {
        return jsonResponse(
          {
            ok: false,
            error: 'Quantidade inválida.',
          },
          400,
        )
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from('message_credit_purchases')
        .insert({
          user_id: targetUserId,
          quantity,
          remaining: quantity,
          amount: 0,
          provider: 'admin',
          provider_payment_id: `ADMIN_GRANT_${crypto.randomUUID()}`,
          status: 'paid',
          paid_at: new Date().toISOString(),
          checkout_type: 'admin_credit',
        })
        .select('*')
        .single()

      if (purchaseError) throw purchaseError

      await logAdminAction({
        supabase,
        adminUserId: adminUser.id,
        targetUserId,
        action,
        payload: {
          quantity,
          note,
          purchase_id: purchase.id,
        },
      })

      return jsonResponse({
        ok: true,
        action,
        purchase,
      })
    }

    if (action === 'CHANGE_PLAN') {
      const planId = String(body.plan_id || '')
      const days = Number(body.days || 30)

      if (!planId) {
        return jsonResponse(
          {
            ok: false,
            error: 'plan_id é obrigatório.',
          },
          400,
        )
      }

      const { data: plan, error: planError } = await supabase
        .from('platform_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle()

      if (planError) throw planError

      if (!plan) {
        return jsonResponse(
          {
            ok: false,
            error: 'Plano não encontrado.',
          },
          404,
        )
      }

      const periodStart = new Date().toISOString()
      const periodEnd = addDays(days || 30)

      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .upsert(
          {
            user_id: targetUserId,
            plan_id: planId,
            status: 'active',
            current_period_start: periodStart,
            current_period_end: periodEnd,
            activated_at: periodStart,
            last_payment_status: 'manual_admin',
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          },
        )
        .select(`
          *,
          plan:platform_plans (*)
        `)
        .single()

      if (subscriptionError) throw subscriptionError

      await logAdminAction({
        supabase,
        adminUserId: adminUser.id,
        targetUserId,
        action,
        payload: {
          plan_id: planId,
          days,
          plan_name: plan.name,
        },
      })

      return jsonResponse({
        ok: true,
        action,
        subscription,
      })
    }

    if (action === 'SET_SUBSCRIPTION_STATUS') {
      const status = String(body.status || '')

      if (!['active', 'inactive', 'cancelled', 'past_due'].includes(status)) {
        return jsonResponse(
          {
            ok: false,
            error: 'Status inválido.',
          },
          400,
        )
      }

      const updatePayload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }

      if (status === 'active') {
        updatePayload.current_period_start = new Date().toISOString()
        updatePayload.current_period_end = addDays(Number(body.days || 30))
        updatePayload.last_payment_status = 'manual_admin'
      }

      const { data: subscription, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .update(updatePayload)
        .eq('user_id', targetUserId)
        .select(`
          *,
          plan:platform_plans (*)
        `)
        .maybeSingle()

      if (subscriptionError) throw subscriptionError

      await logAdminAction({
        supabase,
        adminUserId: adminUser.id,
        targetUserId,
        action,
        payload: {
          status,
          days: body.days || null,
        },
      })

      return jsonResponse({
        ok: true,
        action,
        subscription,
      })
    }

    if (action === 'BLOCK_USER') {
      const reason = String(body.reason || 'Bloqueado pelo administrador.')

      const { data: profile, error: profileError } = await supabase
        .from('app_user_profiles')
        .update({
          is_blocked: true,
          blocked_reason: reason,
          blocked_at: new Date().toISOString(),
          blocked_by: adminUser.id,
        })
        .eq('user_id', targetUserId)
        .select('*')
        .single()

      if (profileError) throw profileError

      await logAdminAction({
        supabase,
        adminUserId: adminUser.id,
        targetUserId,
        action,
        payload: {
          reason,
        },
      })

      return jsonResponse({
        ok: true,
        action,
        profile,
      })
    }

    if (action === 'UNBLOCK_USER') {
      const { data: profile, error: profileError } = await supabase
        .from('app_user_profiles')
        .update({
          is_blocked: false,
          blocked_reason: null,
          blocked_at: null,
          blocked_by: null,
        })
        .eq('user_id', targetUserId)
        .select('*')
        .single()

      if (profileError) throw profileError

      await logAdminAction({
        supabase,
        adminUserId: adminUser.id,
        targetUserId,
        action,
        payload: {},
      })

      return jsonResponse({
        ok: true,
        action,
        profile,
      })
    }

    return jsonResponse(
      {
        ok: false,
        error: `Ação não suportada: ${action}`,
      },
      400,
    )
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