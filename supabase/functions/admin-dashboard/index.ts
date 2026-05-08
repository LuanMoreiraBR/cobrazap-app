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

function startOfDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1)
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

function groupByDay(events: any[], days = 30) {
  const result: Record<string, number> = {}

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result[key] = 0
  }

  for (const event of events) {
    const key = new Date(event.created_at).toISOString().slice(0, 10)

    if (key in result) {
      result[key] += 1
    }
  }

  return Object.entries(result).map(([label, value]) => ({
    label,
    value,
  }))
}

function groupByMonth(events: any[]) {
  const result: Record<string, number> = {}

  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = d.toISOString().slice(0, 7)
    result[key] = 0
  }

  for (const event of events) {
    const key = new Date(event.created_at).toISOString().slice(0, 7)

    if (key in result) {
      result[key] += 1
    }
  }

  return Object.entries(result).map(([label, value]) => ({
    label,
    value,
  }))
}

async function getTwilioBalance() {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')

  if (!accountSid || !authToken) {
    return {
      available: false,
      balance: null,
      currency: null,
      error: 'Twilio não configurado.',
    }
  }

  const auth = btoa(`${accountSid}:${authToken}`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`,
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    return {
      available: false,
      balance: null,
      currency: null,
      error: data?.message || 'Erro ao consultar saldo Twilio.',
    }
  }

  return {
    available: true,
    balance: data.balance,
    currency: data.currency,
    error: null,
  }
}

function isActiveSubscription(subscription: any, now: Date) {
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

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')

    if (!jwt) {
      return jsonResponse(
        {
          ok: false,
          error: 'Usuário não autenticado.',
        },
        401,
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return jsonResponse(
        {
          ok: false,
          error: 'Sessão inválida.',
        },
        401,
      )
    }

    const { data: admin, error: adminError } = await supabase
      .from('platform_admins')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminError) throw adminError

    if (!admin) {
      return jsonResponse(
        {
          ok: false,
          error: 'Acesso negado. Usuário não é admin da plataforma.',
        },
        403,
      )
    }

    const now = new Date()
    const today = startOfDay(now)
    const month = startOfMonth(now)
    const year = startOfYear(now)
    const yearMonth = getYearMonth()
    const onlineCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const [
  profilesResult,
  subscriptionsResult,
  activityResult,
  usageEventsResult,
  monthlyUsageResult,
  creditPurchasesResult,
  platformPaymentsResult,
  clientsResult,
  chargesResult,
  scheduledMessagesResult,
  adminActionsResult,
  twilioBalance,
] = await Promise.all([
      supabase
        .from('app_user_profiles')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('user_subscriptions')
        .select(`
          *,
          plan:platform_plans (*)
        `),

      supabase
        .from('app_user_activity')
        .select('*')
        .gte('last_seen_at', onlineCutoff)
        .order('last_seen_at', { ascending: false }),

      supabase
        .from('message_usage_events')
        .select('*')
        .gte('created_at', year.toISOString()),

      supabase
        .from('user_monthly_usage')
        .select('*')
        .eq('year_month', yearMonth),

      supabase
        .from('message_credit_purchases')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('platform_subscription_payments')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('clients')
        .select('id, user_id, created_at'),

      supabase
        .from('charges')
        .select('id, user_id, client_id, amount, status, payment_status, due_date, created_at'),

      supabase
        .from('scheduled_messages')
        .select('id, user_id, status, error_message, created_at, scheduled_for, sent_at'),

        supabase
        .from('platform_admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100),

      getTwilioBalance(),
    ])

    if (profilesResult.error) throw profilesResult.error
    if (subscriptionsResult.error) throw subscriptionsResult.error
    if (activityResult.error) throw activityResult.error
    if (usageEventsResult.error) throw usageEventsResult.error
    if (monthlyUsageResult.error) throw monthlyUsageResult.error
    if (creditPurchasesResult.error) throw creditPurchasesResult.error
    if (platformPaymentsResult.error) throw platformPaymentsResult.error
    if (clientsResult.error) throw clientsResult.error
    if (chargesResult.error) throw chargesResult.error
    if (scheduledMessagesResult.error) throw scheduledMessagesResult.error
    if (adminActionsResult.error) throw adminActionsResult.error
    const profiles = profilesResult.data || []
    const subscriptions = subscriptionsResult.data || []
    const online = activityResult.data || []
    const usageEvents = usageEventsResult.data || []
    const monthlyUsage = monthlyUsageResult.data || []
    const creditPurchases = creditPurchasesResult.data || []
    const platformPayments = platformPaymentsResult.data || []
    const clients = clientsResult.data || []
    const charges = chargesResult.data || []
    const scheduledMessages = scheduledMessagesResult.data || []
    const adminActions = adminActionsResult.data || []

    const subscriptionByUserId = new Map(
      subscriptions.map((item: any) => [item.user_id, item]),
    )

    const profileByUserId = new Map(
      profiles.map((item: any) => [item.user_id, item]),
    )

    const monthlyUsageByUserId = new Map(
      monthlyUsage.map((item: any) => [item.user_id, item]),
    )

    const clientsByUserId = new Map<string, any[]>()
    for (const client of clients) {
      const list = clientsByUserId.get(client.user_id) || []
      list.push(client)
      clientsByUserId.set(client.user_id, list)
    }

    const chargesByUserId = new Map<string, any[]>()
    for (const charge of charges) {
      const list = chargesByUserId.get(charge.user_id) || []
      list.push(charge)
      chargesByUserId.set(charge.user_id, list)
    }

    const creditsByUserId = new Map<string, number>()
    for (const purchase of creditPurchases) {
      if (purchase.status !== 'paid') continue

      const current = creditsByUserId.get(purchase.user_id) || 0
      creditsByUserId.set(
        purchase.user_id,
        current + Number(purchase.remaining || 0),
      )
    }

    const activeSubscriptions = subscriptions.filter((item: any) =>
      isActiveSubscription(item, now),
    )

    const expiredSubscriptions = subscriptions.filter((item: any) => {
      if (item.status === 'active') {
        return item.current_period_end && new Date(item.current_period_end) <= now
      }

      return item.status && item.status !== 'active'
    })

    const usersCreatedToday = profiles.filter(
      (item: any) => new Date(item.created_at) >= today,
    )

    const usersCreatedMonth = profiles.filter(
      (item: any) => new Date(item.created_at) >= month,
    )

    const messagesToday = usageEvents.filter(
      (item: any) => new Date(item.created_at) >= today,
    )

    const messagesMonth = usageEvents.filter(
      (item: any) => new Date(item.created_at) >= month,
    )

    const paidCreditPurchases = creditPurchases.filter(
      (item: any) => item.status === 'paid',
    )

    const paidCreditPurchasesMonth = paidCreditPurchases.filter(
      (item: any) => item.paid_at && new Date(item.paid_at) >= month,
    )

    const pendingCreditPurchases = creditPurchases.filter(
      (item: any) => item.status === 'pending',
    )

    const approvedPlatformPayments = platformPayments.filter(
      (item: any) => item.status === 'approved',
    )

    const approvedPlatformPaymentsMonth = approvedPlatformPayments.filter(
      (item: any) => item.paid_at && new Date(item.paid_at) >= month,
    )

    const pendingPlatformPayments = platformPayments.filter(
      (item: any) => item.status === 'pending',
    )

    const planRevenueMonth = approvedPlatformPaymentsMonth.reduce(
      (acc: number, item: any) => acc + Number(item.amount || 0),
      0,
    )

    const creditRevenueMonth = paidCreditPurchasesMonth.reduce(
      (acc: number, item: any) => acc + Number(item.amount || 0),
      0,
    )

    const creditRevenueTotal = paidCreditPurchases.reduce(
      (acc: number, item: any) => acc + Number(item.amount || 0),
      0,
    )

    const mrrEstimated = activeSubscriptions.reduce(
      (acc: number, item: any) => acc + Number(item.plan?.price || 0),
      0,
    )

    const scheduledFailed = scheduledMessages.filter(
      (item: any) => item.status === 'failed',
    )

    const scheduledPending = scheduledMessages.filter(
      (item: any) => item.status === 'pending',
    )

    const scheduledProcessing = scheduledMessages.filter(
      (item: any) => item.status === 'processing',
    )

    const chargePaid = charges.filter(
      (item: any) => getChargeStatus(item) === 'pago',
    )

    const chargeOpen = charges.filter(
      (item: any) => getChargeStatus(item) !== 'pago',
    )

    const totalReceived = chargePaid.reduce(
      (acc: number, item: any) => acc + Number(item.amount || 0),
      0,
    )

    const totalOpen = chargeOpen.reduce(
      (acc: number, item: any) => acc + Number(item.amount || 0),
      0,
    )

    const planStatsMap = new Map()

    for (const subscription of activeSubscriptions) {
      const planName = subscription.plan?.name || subscription.plan_id || 'Plano'
      const current = planStatsMap.get(planName) || 0
      planStatsMap.set(planName, current + 1)
    }

    const planStats = Array.from(planStatsMap.entries()).map(
      ([plan, total]) => ({
        plan,
        total,
      }),
    )

    const usersDetailed = profiles.map((profile: any) => {
      const subscription = subscriptionByUserId.get(profile.user_id)
      const active = isActiveSubscription(subscription, now)
      const usage = monthlyUsageByUserId.get(profile.user_id)
      const userClients = clientsByUserId.get(profile.user_id) || []
      const userCharges = chargesByUserId.get(profile.user_id) || []
      const extraCredits = active
        ? Number(creditsByUserId.get(profile.user_id) || 0)
        : 0

      const plan = active ? subscription?.plan : null
      const messageLimit = active
        ? Number(plan?.max_messages_per_month || 0)
        : 10

      const clientLimit = active
        ? Number(plan?.max_clients || 0)
        : 10

      const messagesUsed = Number(usage?.messages_sent || 0)
      const totalMessageLimit =
        messageLimit > 0 ? messageLimit + extraCredits : 0

      const userChargePaid = userCharges.filter(
        (item: any) => getChargeStatus(item) === 'pago',
      )

      const userChargeOpen = userCharges.filter(
        (item: any) => getChargeStatus(item) !== 'pago',
      )

      const receivedAmount = userChargePaid.reduce(
        (acc: number, item: any) => acc + Number(item.amount || 0),
        0,
      )

      const openAmount = userChargeOpen.reduce(
        (acc: number, item: any) => acc + Number(item.amount || 0),
        0,
      )

      const activity = online.find((item: any) => item.user_id === profile.user_id)

      const nearLimit =
        totalMessageLimit > 0 &&
        messagesUsed >= Math.floor(totalMessageLimit * 0.8) &&
        messagesUsed < totalMessageLimit

      const atLimit =
        totalMessageLimit > 0 &&
        messagesUsed >= totalMessageLimit

      return {
  user_id: profile.user_id,
  email: profile.email,
  name: profile.name,
  created_at: profile.created_at,

  is_blocked: Boolean(profile.is_blocked),
  blocked_reason: profile.blocked_reason || null,
  blocked_at: profile.blocked_at || null,

  plan: active ? plan?.name || 'Plano ativo' : 'Teste grátis',
  subscription_status: profile.is_blocked
    ? 'blocked'
    : active
      ? 'active'
      : subscription?.status || 'trial',

  clients_count: userClients.length,
  client_limit: clientLimit,
  charges_count: userCharges.length,
  messages_used: messagesUsed,
  message_limit: totalMessageLimit,
  extra_credits: extraCredits,
  received_amount: receivedAmount,
  open_amount: openAmount,
  last_seen_at: activity?.last_seen_at || null,
  last_route: activity?.route || null,
  near_limit: nearLimit,
  at_limit: atLimit,
}
    })

    const usersNearLimit = usersDetailed.filter((item: any) => item.near_limit)
    const usersAtLimit = usersDetailed.filter((item: any) => item.at_limit)

    const usersNeverSentMessage = usersDetailed.filter(
      (item: any) => item.messages_used === 0,
    )

    const usersWithClients = usersDetailed.filter(
      (item: any) => item.clients_count > 0,
    )

    const usersWithCharges = usersDetailed.filter(
      (item: any) => item.charges_count > 0,
    )

    const usersWithPaymentsReceived = usersDetailed.filter(
      (item: any) => Number(item.received_amount || 0) > 0,
    )

    const onlineUsers = online.map((activity: any) => {
      const profile = profileByUserId.get(activity.user_id)
      const subscription = subscriptionByUserId.get(activity.user_id)
      const active = isActiveSubscription(subscription, now)

      return {
        user_id: activity.user_id,
        email: profile?.email || '',
        name: profile?.name || '',
        route: activity.route,
        last_seen_at: activity.last_seen_at,
        plan: active ? subscription?.plan?.name || 'Plano ativo' : 'Teste grátis',
        subscription_status: active
          ? 'active'
          : subscription?.status || 'trial',
      }
    })

    const recentUsers = usersDetailed
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 20)

    return jsonResponse({
      ok: true,
      admin: {
        user_id: user.id,
        email: user.email,
        role: admin.role,
      },
      summary: {
        total_users: profiles.length,
        users_created_today: usersCreatedToday.length,
        users_created_month: usersCreatedMonth.length,
        online_users: onlineUsers.length,

        active_subscriptions: activeSubscriptions.length,
        trial_users: Math.max(profiles.length - activeSubscriptions.length, 0),
        expired_or_inactive_subscriptions: expiredSubscriptions.length,

        users_near_limit: usersNearLimit.length,
        users_at_limit: usersAtLimit.length,
        users_never_sent_message: usersNeverSentMessage.length,

        messages_today: messagesToday.length,
        messages_month: messagesMonth.length,
        messages_year: usageEvents.length,

        scheduled_failed: scheduledFailed.length,
        scheduled_pending: scheduledPending.length,
        scheduled_processing: scheduledProcessing.length,

        mrr_estimated: mrrEstimated,
        plan_revenue_month: planRevenueMonth,
        credit_revenue_month: creditRevenueMonth,
        credit_revenue_total: creditRevenueTotal,
        revenue_month_total: planRevenueMonth + creditRevenueMonth,

        platform_payments_approved_month: approvedPlatformPaymentsMonth.length,
        platform_payments_pending: pendingPlatformPayments.length,
        credit_purchases_paid: paidCreditPurchases.length,
        credit_purchases_pending: pendingCreditPurchases.length,

        total_clients: clients.length,
        total_charges: charges.length,
        total_received: totalReceived,
        total_open: totalOpen,
      },
      twilio: twilioBalance,
      funnel: {
        accounts_created: profiles.length,
        users_with_clients: usersWithClients.length,
        users_with_charges: usersWithCharges.length,
        users_with_messages: usersDetailed.filter(
          (item: any) => item.messages_used > 0,
        ).length,
        users_with_payments_received: usersWithPaymentsReceived.length,
        active_subscriptions: activeSubscriptions.length,
      },
      charts: {
        messages_by_day: groupByDay(usageEvents),
        messages_by_month: groupByMonth(usageEvents),
        plan_stats: planStats,
      },
      alerts: {
        twilio_error: twilioBalance.error,
        scheduled_failed: scheduledFailed.slice(0, 20),
        users_near_limit: usersNearLimit.slice(0, 20),
        users_at_limit: usersAtLimit.slice(0, 20),
      },
      online_users: onlineUsers,
      recent_users: recentUsers,
      users_detailed: usersDetailed,
      credit_purchases: creditPurchases.slice(0, 30).map((purchase: any) => {
        const profile = profileByUserId.get(purchase.user_id)

        return {
          ...purchase,
          user_name: profile?.name || 'Sem nome',
          user_email: profile?.email || '',
        }

        
      }),

      admin_actions: adminActions.map((action: any) => {
  const adminProfile = profileByUserId.get(action.admin_user_id)
  const targetProfile = action.target_user_id
    ? profileByUserId.get(action.target_user_id)
    : null

  return {
    ...action,
    admin_name: adminProfile?.name || 'Admin',
    admin_email: adminProfile?.email || '',
    target_name: targetProfile?.name || 'Sem usuário',
    target_email: targetProfile?.email || '',
  }
}),

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