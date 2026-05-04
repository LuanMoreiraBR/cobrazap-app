import { supabase } from './supabaseClient'

export async function getPlatformPlans() {
  const { data, error } = await supabase
    .from('platform_plans')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })

  if (error) throw error
  return data
}

export async function getUserSubscription(userId) {
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

export async function getUserMonthlyUsage(userId) {
  const yearMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)

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

export async function createPlatformCheckout({
  userId,
  planId,
  installments = 1,
}) {
  const { data, error } = await supabase.functions.invoke(
    'create-platform-checkout',
    {
      body: {
        user_id: userId,
        plan_id: planId,
        installments,
      },
    },
  )

  if (error) {
    if (error.context) {
      try {
        const errorBody = await error.context.json()
        throw new Error(errorBody?.error || 'Erro ao gerar pagamento do plano.')
      } catch {
        throw new Error(error.message || 'Erro ao gerar pagamento do plano.')
      }
    }

    throw new Error(error.message || 'Erro ao gerar pagamento do plano.')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Erro ao gerar pagamento do plano.')
  }

  return data
}

export function isSubscriptionActive(subscription) {
  if (!subscription) return false
  if (subscription.status !== 'active') return false

  if (!subscription.current_period_end) return true

  return new Date(subscription.current_period_end) > new Date()
}