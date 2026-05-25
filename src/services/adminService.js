import { supabase } from './supabaseClient'

export async function getAdminPlans() {
  const { data, error } = await supabase
    .from('platform_plans')
    .select('*')
    .order('price', { ascending: true })
  if (error) throw error
  return data || []
}

export async function updateAdminPlan(planId, fields) {
  const { error } = await supabase
    .from('platform_plans')
    .update(fields)
    .eq('id', planId)
  if (error) throw error
}

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

export async function getAdminUserDetail(userId) {
  const { data, error } = await supabase.functions.invoke('admin-user-detail', {
    body: {
      user_id: userId,
    },
  })

  if (error) {
    if (error.context) {
      try {
        const errorBody = await error.context.json()
        throw new Error(errorBody?.error || 'Erro ao carregar detalhes do usuário.')
      } catch {
        throw new Error(error.message || 'Erro ao carregar detalhes do usuário.')
      }
    }

    throw new Error(error.message || 'Erro ao carregar detalhes do usuário.')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Erro ao carregar detalhes do usuário.')
  }

  return data
}

export async function getAdminEventLogs({
  provider = 'all',
  status = 'all',
  range = '7d',
  search = '',
  limit = 100,
} = {}) {
  const { data, error } = await supabase.functions.invoke('admin-event-logs', {
    body: {
      provider,
      status,
      range,
      search,
      limit,
    },
  })

  if (error) {
    if (error.context) {
      try {
        const errorBody = await error.context.json()
        throw new Error(errorBody?.error || 'Erro ao carregar logs.')
      } catch {
        throw new Error(error.message || 'Erro ao carregar logs.')
      }
    }

    throw new Error(error.message || 'Erro ao carregar logs.')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Erro ao carregar logs.')
  }

  return data
}

export async function getAdminHealth() {
  const { data, error } = await supabase.functions.invoke('admin-health', {
    body: {},
  })

  if (error) {
    if (error.context) {
      try {
        const errorBody = await error.context.json()
        throw new Error(errorBody?.error || 'Erro ao carregar saúde operacional.')
      } catch {
        throw new Error(error.message || 'Erro ao carregar saúde operacional.')
      }
    }

    throw new Error(error.message || 'Erro ao carregar saúde operacional.')
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Erro ao carregar saúde operacional.')
  }

  return data
}

export async function runAdminScheduledMessageAction({
  messageId,
  action,
}) {
  const { data, error } = await supabase.functions.invoke(
    'admin-scheduled-message-action',
    {
      body: {
        message_id: messageId,
        action,
      },
    },
  )

  if (error) {
    if (error.context) {
      try {
        const errorBody = await error.context.json()
        throw new Error(
          errorBody?.error || 'Erro ao executar ação na mensagem agendada.',
        )
      } catch {
        throw new Error(
          error.message || 'Erro ao executar ação na mensagem agendada.',
        )
      }
    }

    throw new Error(
      error.message || 'Erro ao executar ação na mensagem agendada.',
    )
  }

  if (!data?.ok) {
    throw new Error(
      data?.error || 'Erro ao executar ação na mensagem agendada.',
    )
  }

  return data
}