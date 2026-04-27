import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

function decodeState(state: string) {
  return JSON.parse(atob(state))
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

    if (!userId) throw new Error('user_id ausente no state.')

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

    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const { error } = await supabase.from('user_payment_accounts').upsert(
      {
        user_id: userId,
        provider: 'mercado_pago',
        provider_user_id: String(tokenData.user_id || ''),
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
    return Response.redirect(
      `${getEnv('APP_URL')}/app/configuracoes?mp=error&message=${encodeURIComponent(
        err.message,
      )}`,
      302,
    )
  }
})