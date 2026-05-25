import { supabase } from './supabaseClient'

export async function getPaymentAccount(userId) {
  if (!userId) {
    throw new Error('Usuário não informado.')
  }

  const { data, error } = await supabase
    .from('user_payment_accounts')
    .select(
      'id, provider, provider_user_id, public_key, live_mode, connected_at, expires_at',
    )
    .eq('user_id', userId)
    .eq('provider', 'mercado_pago')
    .maybeSingle()

  if (error) throw error
  return data
}

export async function startMercadoPagoConnection() {
  const { data, error } = await supabase.functions.invoke(
    'mercado-pago-oauth-start',
    {
      body: {},
    },
  )

  if (error) {
    console.error('Erro ao iniciar OAuth Mercado Pago:', error)
    throw new Error(error.message || 'Erro ao iniciar conexão Mercado Pago.')
  }

  if (!data?.ok || !data?.url) {
    throw new Error(data?.error || 'Erro ao iniciar conexão Mercado Pago.')
  }

  window.location.href = data.url
}

export async function disconnectMercadoPago(userId) {
  if (!userId) {
    throw new Error('Usuário não informado.')
  }

  const { error } = await supabase
    .from('user_payment_accounts')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'mercado_pago')

  if (error) throw error
}