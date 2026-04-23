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

export async function createClient({ user_id, name, phone, notes }) {
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