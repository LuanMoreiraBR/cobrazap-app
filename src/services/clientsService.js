import { supabase } from './supabaseClient'

export async function getClients(userId) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function canCreateClient(userId) {
  const { data: subscription, error: subscriptionError } = await supabase
    .from('user_subscriptions')
    .select(`
      *,
      plan:platform_plans (*)
    `)
    .eq('user_id', userId)
    .maybeSingle()

  if (subscriptionError) throw subscriptionError

  if (!subscription || subscription.status !== 'active') {
    return {
      allowed: false,
      reason: 'Você precisa de um plano ativo para cadastrar clientes.',
    }
  }

  if (
    subscription.current_period_end &&
    new Date(subscription.current_period_end) <= new Date()
  ) {
    return {
      allowed: false,
      reason: 'Sua assinatura expirou. Renove seu plano para cadastrar clientes.',
    }
  }

  const maxClients = subscription.plan?.max_clients

  if (!maxClients) {
    return {
      allowed: true,
    }
  }

  const { count, error: countError } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (countError) throw countError

  if (Number(count || 0) >= Number(maxClients)) {
    return {
      allowed: false,
      reason: `Seu plano permite até ${maxClients} clientes cadastrados.`,
    }
  }

  return {
    allowed: true,
  }
}

export async function createClient({ user_id, name, phone, notes }) {
  const permission = await canCreateClient(user_id)

  if (!permission.allowed) {
    throw new Error(permission.reason)
  }

  const { data, error } = await supabase
    .from('clients')
    .insert([{ user_id, name, phone, notes }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateClient({ id, user_id, name, phone, notes }) {
  const { data, error } = await supabase
    .from('clients')
    .update({ name, phone, notes })
    .eq('id', id)
    .eq('user_id', user_id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteClient(id, userId) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}