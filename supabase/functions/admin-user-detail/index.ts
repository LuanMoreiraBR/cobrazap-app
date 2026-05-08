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

function getYearMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

function isActiveSubscription(subscription: any, now = new Date()) {
  if (!subscription) return false
  if (subscription.status !== 'active') return false
  if (!subscription.current_period_end) return true

  return new Date(subscription.current_period_end) > now
}

function getChargeStatus(charge: any) {
  if (charge.status === 'pago') return 'pago'

  if (!charge.due_date) return charge.status || 'pendente'

  const today = new Date()
  const due = new Date(`${charge.due_date}T00:00:00`)
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )

  if (due < todayOnly) return 'atrasado'

  return charge.status || 'pendente'
}

async function getAuthenticatedAdmin(req: Request, supabase: any) {
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
    error: userError,
  } = await supabase.auth.getUser(jwt)

  if (userError || !user) {
    return {
      user: null,
      error: 'Sessão inválida.',
      status: 401,
    }
  }

  const { data: admin, error: adminError } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) throw adminError

  if (!admin) {
    return {
      user: null,
      error: 'Acesso negado. Usuário não é admin da plataforma.',
      status: 403,
    }
  }

  return {
    user,
    admin,
    error: null,
    status: 200,
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

    const auth = await getAuthenticatedAdmin(req, supabase)

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
    const targetUserId = String(body.user_id || '')

    if (!targetUserId) {
      return jsonResponse(
        {
          ok: false,
          error: 'user_id é obrigatório.',
        },
        400,
      )
    }

    const yearMonth = getYearMonth()
    const now = new Date()

    const [
      profileResult,
      subscriptionResult,
      monthlyUsageResult,
      activityResult,
      clientsResult,
      chargesResult,
      creditsResult,
      creditPurchasesResult,
      adminActionsResult,
      subscriptionPaymentsResult,
      usageEventsResult,
      scheduledMessagesResult,
    ] = await Promise.all([
      supabase
        .from('app_user_profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle(),

      supabase
        .from('user_subscriptions')
        .select(`
          *,
          plan:platform_plans (*)
        `)
        .eq('user_id', targetUserId)
        .maybeSingle(),

      supabase
        .from('user_monthly_usage')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('year_month', yearMonth)
        .maybeSingle(),

      supabase
        .from('app_user_activity')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle(),

      supabase
        .from('clients')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),

      supabase
        .from('charges')
        .select(`
          *,
          client:clients (
            id,
            name,
            phone
          )
        `)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),

      supabase
        .from('message_credit_purchases')
        .select('remaining')
        .eq('user_id', targetUserId)
        .eq('status', 'paid')
        .gt('remaining', 0),

      supabase
        .from('message_credit_purchases')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),

      supabase
        .from('platform_admin_actions')
        .select('*')
        .eq('target_user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('platform_subscription_payments')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false }),

      supabase
        .from('message_usage_events')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(100),

      supabase
        .from('scheduled_messages')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (profileResult.error) throw profileResult.error
    if (subscriptionResult.error) throw subscriptionResult.error
    if (monthlyUsageResult.error) throw monthlyUsageResult.error
    if (activityResult.error) throw activityResult.error
    if (clientsResult.error) throw clientsResult.error
    if (chargesResult.error) throw chargesResult.error
    if (creditsResult.error) throw creditsResult.error
    if (creditPurchasesResult.error) throw creditPurchasesResult.error
    if (adminActionsResult.error) throw adminActionsResult.error
    if (subscriptionPaymentsResult.error) throw subscriptionPaymentsResult.error
    if (usageEventsResult.error) throw usageEventsResult.error
    if (scheduledMessagesResult.error) throw scheduledMessagesResult.error

    const profile = profileResult.data

    if (!profile) {
      return jsonResponse(
        {
          ok: false,
          error: 'Usuário não encontrado.',
        },
        404,
      )
    }

    const subscription = subscriptionResult.data
    const monthlyUsage =
      monthlyUsageResult.data || {
        messages_sent: 0,
        clients_created: 0,
      }

    const clients = clientsResult.data || []
    const charges = chargesResult.data || []
    const creditPurchases = creditPurchasesResult.data || []
    const adminActions = adminActionsResult.data || []
    const subscriptionPayments = subscriptionPaymentsResult.data || []
    const usageEvents = usageEventsResult.data || []
    const scheduledMessages = scheduledMessagesResult.data || []

    const hasActivePlan = isActiveSubscription(subscription, now)
    const plan = hasActivePlan ? subscription?.plan : null

    const extraCredits = hasActivePlan
      ? (creditsResult.data || []).reduce(
          (total: number, item: any) => total + Number(item.remaining || 0),
          0,
        )
      : 0

    const messageLimit = hasActivePlan
      ? Number(plan?.max_messages_per_month || 0)
      : 10

    const clientLimit = hasActivePlan ? Number(plan?.max_clients || 0) : 10

    const totalMessageLimit =
      messageLimit > 0 ? messageLimit + extraCredits : 0

    const messagesUsed = Number(monthlyUsage?.messages_sent || 0)

    const enrichedCharges = charges.map((charge: any) => ({
      ...charge,
      computed_status: getChargeStatus(charge),
    }))

    const paidCharges = enrichedCharges.filter(
      (charge: any) => charge.computed_status === 'pago',
    )

    const openCharges = enrichedCharges.filter(
      (charge: any) => charge.computed_status !== 'pago',
    )

    const overdueCharges = enrichedCharges.filter(
      (charge: any) => charge.computed_status === 'atrasado',
    )

    const receivedAmount = paidCharges.reduce(
      (total: number, charge: any) => total + Number(charge.amount || 0),
      0,
    )

    const openAmount = openCharges.reduce(
      (total: number, charge: any) => total + Number(charge.amount || 0),
      0,
    )

    const paidCredits = creditPurchases.filter(
      (item: any) => item.status === 'paid',
    )

    const pendingCredits = creditPurchases.filter(
      (item: any) => item.status === 'pending',
    )

    const failedScheduled = scheduledMessages.filter(
      (item: any) => item.status === 'failed',
    )

    return jsonResponse({
      ok: true,
      user: {
        user_id: profile.user_id,
        email: profile.email,
        name: profile.name,
        created_at: profile.created_at,
        is_blocked: Boolean(profile.is_blocked),
        blocked_reason: profile.blocked_reason || null,
        blocked_at: profile.blocked_at || null,
      },
      subscription: {
        raw: subscription,
        has_active_plan: hasActivePlan,
        plan: hasActivePlan ? plan : null,
        plan_name: hasActivePlan ? plan?.name || 'Plano ativo' : 'Teste grátis',
        status: profile.is_blocked
          ? 'blocked'
          : hasActivePlan
            ? 'active'
            : subscription?.status || 'trial',
        current_period_start: subscription?.current_period_start || null,
        current_period_end: subscription?.current_period_end || null,
      },
      usage: {
        year_month: yearMonth,
        messages_used: messagesUsed,
        message_limit: messageLimit,
        extra_credits: extraCredits,
        total_message_limit: totalMessageLimit,
        messages_available:
          totalMessageLimit > 0
            ? Math.max(totalMessageLimit - messagesUsed, 0)
            : null,
        clients_count: clients.length,
        client_limit: clientLimit,
      },
      financial: {
        charges_count: charges.length,
        paid_charges_count: paidCharges.length,
        open_charges_count: openCharges.length,
        overdue_charges_count: overdueCharges.length,
        received_amount: receivedAmount,
        open_amount: openAmount,
      },
      credits: {
        total_remaining: extraCredits,
        paid_count: paidCredits.length,
        pending_count: pendingCredits.length,
        purchases: creditPurchases,
      },
      activity: activityResult.data || null,
      clients,
      charges: enrichedCharges,
      admin_actions: adminActions,
      subscription_payments: subscriptionPayments,
      usage_events: usageEvents,
      scheduled_messages: scheduledMessages,
      scheduled_failed: failedScheduled,
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