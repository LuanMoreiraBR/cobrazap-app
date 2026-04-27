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
    const { user_id } = await req.json()

    if (!user_id) throw new Error('user_id não informado.')

    const params = new URLSearchParams({
      client_id: getEnv('MERCADO_PAGO_CLIENT_ID'),
      response_type: 'code',
      platform_id: 'mp',
      state: encodeState({
        user_id,
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
      JSON.stringify({ ok: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})