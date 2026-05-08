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

function getCurrentYearMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

function hoursAgo(hours: number) {
  const date = new Date()
  date.setHours(date.getHours() - hours)
  return date.toISOString()
}

function minutesAgo(minutes: number) {
  const date = new Date()
  date.setMinutes(date.getMinutes() - minutes)
  return date.toISOString()
}

function daysFromNow(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function calculateSeverity({
  twilioErrors24h,
  mercadoPagoErrors24h,
  scheduledFailed,
  scheduledStuck,
  oldPendingPayments,
  oldPendingCreditPurchases,
  expiredSubscriptions,
  usersAtLimit,
}: {
  twilioErrors24h: number
  mercadoPagoErrors24h: number
  scheduledFailed: number
  scheduledStuck: number
  oldPendingPayments: number
  oldPendingCreditPurchases: number
  expiredSubscriptions: number
  usersAtLimit: number
}) {
  if (
    twilioErrors24h >= 5 ||
    mercadoPagoErrors24h >= 5 ||
    scheduledStuck >= 3 ||
    scheduledFailed >= 10
  ) {
    return 'critical'
  }

  if (
    twilioErrors24h > 0 ||
    mercadoPagoErrors24h > 0 ||
    scheduledFailed > 0 ||
    scheduledStuck > 0 ||
    oldPendingPayments > 0 ||
    oldPendingCreditPurchases > 0 ||
    expiredSubscriptions > 0 ||
    usersAtLimit > 0
  ) {
    return 'warning'
  }

  return 'ok'
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

function buildRecommendations(summary: any) {
  const recommendations = []

  if (summary.twilio_errors_24h > 0) {
    recommendations.push({
      type: 'twilio',
      severity: summary.twilio_errors_24h >= 5 ? 'critical' : 'warning',
      title: 'Verificar erros da Twilio',
      description:
        'Existem erros de envio WhatsApp nas últimas 24h. Abra a aba Logs filtrando por Twilio e Error.',
      action: 'Ver logs Twilio',
    })
  }

  if (summary.mercado_pago_errors_24h > 0) {
    recommendations.push({
      type: 'mercado_pago',
      severity: summary.mercado_pago_errors_24h >= 5 ? 'critical' : 'warning',
      title: 'Verificar erros do Mercado Pago',
      description:
        'Existem erros de webhook/pagamento nas últimas 24h. Confira webhooks, pagamentos pendentes e logs.',
      action: 'Ver logs Mercado Pago',
    })
  }

  if (summary.scheduled_stuck > 0) {
    recommendations.push({
      type: 'scheduled_messages',
      severity: 'critical',
      title: 'Mensagens presas em processamento',
      description:
        'Existem mensagens em processing há mais de 15 minutos. Elas podem precisar voltar para pending ou serem reprocessadas.',
      action: 'Reprocessar mensagens presas',
    })
  }

  if (summary.scheduled_failed > 0) {
    recommendations.push({
      type: 'scheduled_messages',
      severity: 'warning',
      title: 'Mensagens agendadas com falha',
      description:
        'Existem mensagens agendadas com status failed. Confira motivo do erro e decida se deve reenviar.',
      action: 'Ver mensagens com falha',
    })
  }

  if (summary.old_pending_payments > 0) {
    recommendations.push({
      type: 'payments',
      severity: 'warning',
      title: 'Pagamentos de plano pendentes antigos',
      description:
        'Existem pagamentos de assinatura pendentes há mais de 30 minutos. Pode ser abandono de checkout ou falha de webhook.',
      action: 'Conferir pagamentos pendentes',
    })
  }

  if (summary.old_pending_credit_purchases > 0) {
    recommendations.push({
      type: 'credits',
      severity: 'warning',
      title: 'Compras de créditos pendentes antigas',
      description:
        'Existem compras de créditos pendentes há mais de 30 minutos. Confira se o Mercado Pago retornou webhook.',
      action: 'Conferir compras pendentes',
    })
  }

  if (summary.expired_subscriptions > 0) {
    recommendations.push({
      type: 'subscriptions',
      severity: 'warning',
      title: 'Assinaturas vencidas',
      description:
        'Existem assinaturas marcadas como active, mas com período vencido. Verifique se devem ser inativadas.',
      action: 'Revisar assinaturas vencidas',
    })
  }

  if (summary.expiring_subscriptions_3d > 0) {
    recommendations.push({
      type: 'subscriptions',
      severity: 'info',
      title: 'Assinaturas vencendo em breve',
      description:
        'Existem assinaturas vencendo nos próximos 3 dias. Pode ser útil acompanhar renovações.',
      action: 'Acompanhar renovações',
    })
  }

  if (summary.users_at_limit > 0) {
    recommendations.push({
      type: 'usage',
      severity: 'warning',
      title: 'Usuários no limite de mensagens',
      description:
        'Existem usuários que atingiram o limite mensal. Eles podem precisar comprar créditos ou mudar de plano.',
      action: 'Oferecer upgrade/créditos',
    })
  }

  if (summary.blocked_users > 0) {
    recommendations.push({
      type: 'users',
      severity: 'info',
      title: 'Usuários bloqueados',
      description:
        'Existem usuários bloqueados. Revise se algum bloqueio deve ser removido.',
      action: 'Revisar bloqueios',
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'ok',
      severity: 'ok',
      title: 'Operação saudável',
      description:
        'Nenhum alerta operacional importante encontrado no momento.',
      action: 'Continuar monitorando',
    })
  }

  return recommendations
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

    const nowIso = new Date().toISOString()
    const last24h = hoursAgo(24)
    const staleProcessingDate = minutesAgo(15)
    const oldPendingDate = minutesAgo(30)
    const expiringIn3Days = daysFromNow(3)
    const yearMonth = getCurrentYearMonth()

    const [
      twilioErrorsResult,
      mercadoPagoErrorsResult,
      scheduledFailedResult,
      scheduledStuckResult,
      oldPendingPaymentsResult,
      oldPendingCreditPurchasesResult,
      expiredSubscriptionsResult,
      expiringSubscriptionsResult,
      blockedUsersResult,
      activeSubscriptionsResult,
      monthlyUsageResult,
      extraCreditsResult,
      recentErrorsResult,
      stuckMessagesResult,
      failedMessagesResult,
      oldPaymentsListResult,
      oldCreditsListResult,
    ] = await Promise.all([
      supabase
        .from('platform_event_logs')
        .select('id', { count: 'exact', head: true })
        .eq('provider', 'twilio')
        .eq('status', 'error')
        .gte('created_at', last24h),

      supabase
        .from('platform_event_logs')
        .select('id', { count: 'exact', head: true })
        .eq('provider', 'mercado_pago')
        .eq('status', 'error')
        .gte('created_at', last24h),

      supabase
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed'),

      supabase
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'processing')
        .lt('processing_started_at', staleProcessingDate),

      supabase
        .from('platform_subscription_payments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', oldPendingDate),

      supabase
        .from('message_credit_purchases')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('created_at', oldPendingDate),

      supabase
        .from('user_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .lt('current_period_end', nowIso),

      supabase
        .from('user_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('current_period_end', nowIso)
        .lte('current_period_end', expiringIn3Days),

      supabase
        .from('app_user_profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('is_blocked', true),

      supabase
        .from('user_subscriptions')
        .select(`
          user_id,
          status,
          current_period_end,
          plan:platform_plans (
            id,
            name,
            max_messages_per_month
          )
        `)
        .eq('status', 'active'),

      supabase
        .from('user_monthly_usage')
        .select('user_id, messages_sent')
        .eq('year_month', yearMonth),

      supabase
        .from('message_credit_purchases')
        .select('user_id, remaining')
        .eq('status', 'paid')
        .gt('remaining', 0),

      supabase
        .from('platform_event_logs')
        .select(`
          id,
          provider,
          event_type,
          user_id,
          status,
          message,
          error_message,
          created_at
        `)
        .eq('status', 'error')
        .gte('created_at', last24h)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('scheduled_messages')
        .select(`
          id,
          user_id,
          charge_id,
          client_id,
          attempts,
          error_message,
          processing_started_at,
          scheduled_for,
          created_at
        `)
        .eq('status', 'processing')
        .lt('processing_started_at', staleProcessingDate)
        .order('processing_started_at', { ascending: true })
        .limit(20),

      supabase
        .from('scheduled_messages')
        .select(`
          id,
          user_id,
          charge_id,
          client_id,
          attempts,
          error_message,
          scheduled_for,
          last_attempt_at,
          created_at
        `)
        .eq('status', 'failed')
        .order('last_attempt_at', { ascending: false })
        .limit(20),

      supabase
        .from('platform_subscription_payments')
        .select(`
          id,
          user_id,
          plan_id,
          amount,
          status,
          created_at
        `)
        .eq('status', 'pending')
        .lt('created_at', oldPendingDate)
        .order('created_at', { ascending: true })
        .limit(20),

      supabase
        .from('message_credit_purchases')
        .select(`
          id,
          user_id,
          quantity,
          remaining,
          amount,
          status,
          created_at
        `)
        .eq('status', 'pending')
        .lt('created_at', oldPendingDate)
        .order('created_at', { ascending: true })
        .limit(20),
    ])

    const results = [
      twilioErrorsResult,
      mercadoPagoErrorsResult,
      scheduledFailedResult,
      scheduledStuckResult,
      oldPendingPaymentsResult,
      oldPendingCreditPurchasesResult,
      expiredSubscriptionsResult,
      expiringSubscriptionsResult,
      blockedUsersResult,
      activeSubscriptionsResult,
      monthlyUsageResult,
      extraCreditsResult,
      recentErrorsResult,
      stuckMessagesResult,
      failedMessagesResult,
      oldPaymentsListResult,
      oldCreditsListResult,
    ]

    for (const result of results) {
      if (result.error) throw result.error
    }

    const usageByUserId = Object.fromEntries(
      (monthlyUsageResult.data || []).map((item: any) => [
        item.user_id,
        Number(item.messages_sent || 0),
      ]),
    )

    const creditsByUserId: Record<string, number> = {}

    for (const item of extraCreditsResult.data || []) {
      creditsByUserId[item.user_id] =
        Number(creditsByUserId[item.user_id] || 0) + Number(item.remaining || 0)
    }

    const usersAtLimitList = []

    for (const subscription of activeSubscriptionsResult.data || []) {
      const periodIsValid =
        !subscription.current_period_end ||
        new Date(subscription.current_period_end) > new Date()

      if (!periodIsValid) continue

      const plan = Array.isArray(subscription.plan)
        ? subscription.plan[0]
        : subscription.plan

      const baseLimit = Number(plan?.max_messages_per_month || 0)

      if (!baseLimit) continue

      const totalLimit = baseLimit + Number(creditsByUserId[subscription.user_id] || 0)
      const used = Number(usageByUserId[subscription.user_id] || 0)

      if (used >= totalLimit) {
        usersAtLimitList.push({
          user_id: subscription.user_id,
          plan_name: plan?.name || null,
          messages_used: used,
          message_limit: totalLimit,
        })
      }
    }

    const allUserIds = Array.from(
      new Set([
        ...usersAtLimitList.map((item) => item.user_id),
        ...(recentErrorsResult.data || []).map((item: any) => item.user_id),
        ...(stuckMessagesResult.data || []).map((item: any) => item.user_id),
        ...(failedMessagesResult.data || []).map((item: any) => item.user_id),
        ...(oldPaymentsListResult.data || []).map((item: any) => item.user_id),
        ...(oldCreditsListResult.data || []).map((item: any) => item.user_id),
      ].filter(Boolean)),
    )

    let profilesByUserId: Record<string, any> = {}

    if (allUserIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('app_user_profiles')
        .select('user_id, name, email')
        .in('user_id', allUserIds)

      if (profilesError) throw profilesError

      profilesByUserId = Object.fromEntries(
        (profiles || []).map((profile: any) => [profile.user_id, profile]),
      )
    }

    function addProfile(item: any) {
      const profile = profilesByUserId[item.user_id] || null

      return {
        ...item,
        user_name: profile?.name || null,
        user_email: profile?.email || null,
      }
    }

    const summary = {
      twilio_errors_24h: Number(twilioErrorsResult.count || 0),
      mercado_pago_errors_24h: Number(mercadoPagoErrorsResult.count || 0),
      scheduled_failed: Number(scheduledFailedResult.count || 0),
      scheduled_stuck: Number(scheduledStuckResult.count || 0),
      old_pending_payments: Number(oldPendingPaymentsResult.count || 0),
      old_pending_credit_purchases: Number(
        oldPendingCreditPurchasesResult.count || 0,
      ),
      expired_subscriptions: Number(expiredSubscriptionsResult.count || 0),
      expiring_subscriptions_3d: Number(expiringSubscriptionsResult.count || 0),
      users_at_limit: usersAtLimitList.length,
      blocked_users: Number(blockedUsersResult.count || 0),
    }

    const severity = calculateSeverity({
      twilioErrors24h: summary.twilio_errors_24h,
      mercadoPagoErrors24h: summary.mercado_pago_errors_24h,
      scheduledFailed: summary.scheduled_failed,
      scheduledStuck: summary.scheduled_stuck,
      oldPendingPayments: summary.old_pending_payments,
      oldPendingCreditPurchases: summary.old_pending_credit_purchases,
      expiredSubscriptions: summary.expired_subscriptions,
      usersAtLimit: summary.users_at_limit,
    })

    return jsonResponse({
      ok: true,
      checked_at: new Date().toISOString(),
      severity,
      summary,
      recommendations: buildRecommendations(summary),
      details: {
        recent_errors: (recentErrorsResult.data || []).map(addProfile),
        stuck_messages: (stuckMessagesResult.data || []).map(addProfile),
        failed_messages: (failedMessagesResult.data || []).map(addProfile),
        old_pending_payments: (oldPaymentsListResult.data || []).map(addProfile),
        old_pending_credit_purchases: (oldCreditsListResult.data || []).map(
          addProfile,
        ),
        users_at_limit: usersAtLimitList.map(addProfile),
      },
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