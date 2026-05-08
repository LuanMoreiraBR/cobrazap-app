import { supabase } from './supabaseClient'

export async function updateUserActivity({ userId, route }) {
  if (!userId) return

  const { error } = await supabase
    .from('app_user_activity')
    .upsert(
      {
        user_id: userId,
        route,
        user_agent: navigator.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      },
    )

  if (error) {
    console.error('Erro ao atualizar atividade do usuário:', error)
  }
}