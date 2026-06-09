import { supabase } from './supabaseClient'
import { getExtraMessageCredits } from './platformBillingService'

export const FREE_TRIAL_MESSAGE_LIMIT = 10
export const FREE_TRIAL_CLIENT_LIMIT = 10

function getCurrentYearMonth() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

export async function getUserSubscriptionWithPlan(userId) {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:platform_plans (*)
    `)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export function isSubscriptionActive(subscription) {
  if (!subscription) return false
  if (subscription.status !== 'active') return false
  if (!subscription.current_period_end) return true

  return new Date(subscription.current_period_end) > new Date()
}

export async function getMonthlyUsage(userId) {
  const yearMonth = getCurrentYearMonth()

  const { data, error } = await supabase
    .from('user_monthly_usage')
    .select('*')
    .eq('user_id', userId)
    .eq('year_month', yearMonth)
    .maybeSingle()

  if (error) throw error

  return (
    data || {
      user_id: userId,
      year_month: yearMonth,
      messages_sent: 0,
      clients_created: 0,
    }
  )
}

// Total de mensagens enviadas em todos os meses (cota acumulada do trial).
export async function getLifetimeMessagesUsed(userId) {
  const { data, error } = await supabase
    .from('user_monthly_usage')
    .select('messages_sent')
    .eq('user_id', userId)

  if (error) throw error

  return (data || []).reduce(
    (total, row) => total + Number(row.messages_sent || 0),
    0,
  )
}

export async function getClientUsage(userId) {
  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error) throw error

  return Number(count || 0)
}

export async function getUsageSummary(userId) {
  const [subscription, monthlyUsage, lifetimeMessagesUsed, clientsUsed, rawExtraCredits] =
    await Promise.all([
      getUserSubscriptionWithPlan(userId),
      getMonthlyUsage(userId),
      getLifetimeMessagesUsed(userId),
      getClientUsage(userId),
      getExtraMessageCredits(userId),
    ])

  const hasActivePlan = isSubscriptionActive(subscription)
  const plan = hasActivePlan ? subscription?.plan : null

  // Plano gratuito (preço 0) é um trial único: cota acumulada, não renova por mês.
  const isFreePlan = !hasActivePlan || Number(plan?.price ?? 0) === 0

  const messageLimit = isFreePlan
    ? Number(plan?.max_messages_per_month) || FREE_TRIAL_MESSAGE_LIMIT
    : Number(plan?.max_messages_per_month || 0)

  const clientLimit = hasActivePlan
    ? Number(plan?.max_clients || 0)
    : FREE_TRIAL_CLIENT_LIMIT

  // Gratuito conta o total acumulado; pago conta apenas o mês atual.
  const messagesUsed = isFreePlan
    ? Number(lifetimeMessagesUsed || 0)
    : Number(monthlyUsage?.messages_sent || 0)

  // Créditos extras só contam se o plano estiver ativo.
  // Se o plano estiver inativo, os créditos continuam no banco,
  // mas ficam congelados até o usuário reativar uma assinatura.
  const extraCredits = hasActivePlan ? Number(rawExtraCredits || 0) : 0

  const totalMessageLimit =
    messageLimit > 0 ? messageLimit + extraCredits : 0

  return {
    subscription,
    plan,
    hasActivePlan,

    messagesUsed,
    messageLimit,
    extraCredits,
    totalMessageLimit,
    messagesAvailable:
      totalMessageLimit > 0
        ? Math.max(totalMessageLimit - messagesUsed, 0)
        : null,
    canSendMessage:
      totalMessageLimit <= 0 || messagesUsed < totalMessageLimit,

    clientsUsed,
    clientLimit,
    canCreateClient: clientLimit <= 0 || clientsUsed < clientLimit,
  }
}