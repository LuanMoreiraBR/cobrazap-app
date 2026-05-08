import { supabase } from './supabaseClient'

export async function getMyAccountStatus(userId) {
  const { data, error } = await supabase
    .from('app_user_profiles')
    .select('user_id, email, name, is_blocked, blocked_reason')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  return data
}