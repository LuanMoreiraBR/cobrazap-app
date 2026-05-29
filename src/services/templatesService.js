import { supabase } from './supabaseClient'

export async function getTemplates(userId) {
  const { data, error } = await supabase
    .from('charge_templates')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function createTemplate({ user_id, name, content }) {
  const { data, error } = await supabase
    .from('charge_templates')
    .insert([{ user_id, name, content }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTemplate({ id, user_id, name, content }) {
  const { data, error } = await supabase
    .from('charge_templates')
    .update({ name, content })
    .eq('id', id)
    .eq('user_id', user_id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteTemplate(id, userId) {
  const { error } = await supabase
    .from('charge_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error
}
