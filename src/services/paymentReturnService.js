import { supabase } from './supabaseClient'
import {
  getUserSubscription,
  isSubscriptionActive,
} from './platformBillingService'

export async function checkPlanReturn(userId) {
  const subscription = await getUserSubscription(userId)

  return {
    ok: true,
    confirmed: isSubscriptionActive(subscription),
    subscription,
  }
}

export async function checkAutoRenewReturn(userId) {
  const subscription = await getUserSubscription(userId)

  const confirmed =
    !!subscription?.auto_renew &&
    ['authorized', 'active'].includes(
      String(subscription?.auto_renew_status || '').toLowerCase(),
    )

  return {
    ok: true,
    confirmed,
    subscription,
  }
}

export async function checkMessageCreditsReturn(userId) {
  const { data, error } = await supabase
    .from('message_credit_purchases')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  const status = String(data?.status || '').toLowerCase()

  return {
    ok: true,
    confirmed: ['paid', 'approved'].includes(status),
    purchase: data,
  }
}

export async function checkChargeReturn(userId, chargeId) {
  if (!chargeId) {
    return {
      ok: true,
      confirmed: false,
      charge: null,
    }
  }

  const { data, error } = await supabase
    .from('charges')
    .select('*')
    .eq('id', chargeId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  return {
    ok: true,
    confirmed: String(data?.status || '').toLowerCase() === 'paid',
    charge: data,
  }
}