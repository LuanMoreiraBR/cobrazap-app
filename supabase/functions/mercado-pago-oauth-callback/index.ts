import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

function decodeState(state: string) {
  try {
    return JSON.parse(atob(state))
  } catch {
    throw new Error('State OAuth inválido.')
  }
}

function getExpiresAt(expiresIn?: number) {
  if (!expiresIn) return null
  return new Date(Date.now() + Number(expiresIn) * 1000).toISOString()
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code) throw new Error('Código OAuth não informado.')
    if (!state) throw new Error('State OAuth não informado.')

    const decodedState = decodeState(state)
    const userId = decodedState.user_id

    if (!userId || typeof userId !== 'string') {
      throw new Error('user_id ausente ou inválido no state.')
    }

    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_secret: getEnv('MERCADO_PAGO_CLIENT_SECRET'),
        client_id: getEnv('MERCADO_PAGO_CLIENT_ID'),
        grant_type: 'authorization_code',
        code,
        redirect_uri: getEnv('MERCADO_PAGO_REDIRECT_URI'),
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      throw new Error(`Erro OAuth Mercado Pago: ${JSON.stringify(tokenData)}`)
    }

    if (!tokenData.access_token) {
      throw new Error('Mercado Pago não retornou access_token.')
    }

    const meResponse = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    })

    const meData = await meResponse.json()

    if (!meResponse.ok) {
      throw new Error(`Erro ao consultar usuário Mercado Pago: ${JSON.stringify(meData)}`)
    }

    console.log('Mercado Pago OAuth conectado:', {
      app_user_id: userId,
      oauth_user_id: tokenData.user_id,
      users_me_id: meData.id,
      users_me_nickname: meData.nickname,
      users_me_email: meData.email,
      live_mode: tokenData.live_mode,
    })

    const mercadoPagoUserId = String(meData.id || tokenData.user_id || '')

    if (!mercadoPagoUserId) {
      throw new Error('Não foi possível identificar o usuário Mercado Pago conectado.')
    }

    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const { error } = await supabase.from('user_payment_accounts').upsert(
      {
        user_id: userId,
        provider: 'mercado_pago',
        provider_user_id: mercadoPagoUserId,
        public_key: tokenData.public_key || null,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: tokenData.token_type || null,
        scope: tokenData.scope || null,
        live_mode: tokenData.live_mode ?? null,
        expires_at: getExpiresAt(tokenData.expires_in),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,provider',
      },
    )

    if (error) throw error

    return Response.redirect(
      `${getEnv('APP_URL')}/app/configuracoes?mp=connected`,
      302,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro inesperado.'

    return Response.redirect(
      `${getEnv('APP_URL')}/app/configuracoes?mp=error&message=${encodeURIComponent(
        message,
      )}`,
      302,
    )
  }
})