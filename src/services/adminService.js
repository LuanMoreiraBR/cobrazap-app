import { supabase } from './supabaseClient'

export async function getAdminDashboard() {
  const { data, error } = await supabase.functions.invoke('admin-dashboard', {
    body: {},
  })

  if (error) {
    if (error.context) {
      try {
        const errorBody = await error.context.json()
        throw new Error(errorBody?.error || 'Erro ao carregar painel admin.')
      } catch {
        throw new Error(error.message || 'Erro ao carregar painel admin.')
      }
    }

    throw new Error(error.message || 'Erro ao carregar painel admin.')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Erro ao carregar painel admin.')
  }

  return data
}

export async function isPlatformAdmin(userId) {
  const { data, error } = await supabase
    .from('platform_admins')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error

  return data
}
export async function runAdminUserAction(payload) {
  const { data, error } = await supabase.functions.invoke('admin-user-action', {
    body: payload,
  })

  if (error) {
    if (error.context) {
      try {
        const errorBody = await error.context.json()
        throw new Error(errorBody?.error || 'Erro ao executar ação admin.')
      } catch {
        throw new Error(error.message || 'Erro ao executar ação admin.')
      }
    }

    throw new Error(error.message || 'Erro ao executar ação admin.')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Erro ao executar ação admin.')
  }

  return data
}