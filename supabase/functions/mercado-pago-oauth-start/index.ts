import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

function encodeState(payload: Record<string, unknown>) {
  return btoa(JSON.stringify(payload))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''

    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    )

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Usuário não autenticado.')
    }

    const params = new URLSearchParams({
      client_id: getEnv('MERCADO_PAGO_CLIENT_ID'),
      response_type: 'code',
      platform_id: 'mp',
      state: encodeState({
        user_id: user.id,
        nonce: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      }),
      redirect_uri: getEnv('MERCADO_PAGO_REDIRECT_URI'),
    })

    return new Response(
      JSON.stringify({
        ok: true,
        url: `https://auth.mercadopago.com.br/authorization?${params.toString()}`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Erro inesperado.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})