import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function onlyDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function getBaseAppUrl() {
  return (
    Deno.env.get('APP_URL') ||
    Deno.env.get('SITE_URL') ||
    'https://seu-site.vercel.app'
  )
}

function getNotificationUrl() {
  const customUrl = Deno.env.get('MERCADO_PAGO_NOTIFICATION_URL')

  if (customUrl) return customUrl

  const supabaseUrl = Deno.env.get('SUPABASE_URL')

  return `${supabaseUrl}/functions/v1/mercado-pago-webhook`
}

function normalizePaymentMethods(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)

      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item))
      }
    } catch {
      return value
        .replace(/[{}[\]"]/g, '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }

  return ['pix']
}

function isTrue(value: unknown) {
  return value === true || String(value).toLowerCase() === 'true'
}

function shouldUseCheckoutProForCharge(charge: any) {
  const paymentMethods = normalizePaymentMethods(charge?.payment_methods)

  return (
    isTrue(charge?.credit_card_enabled) ||
    paymentMethods.includes('credit_card')
  )
}

function isExpiredOrNearExpiration(expiresAt: string | null | undefined) {
  if (!expiresAt) return false

  const expires = new Date(expiresAt).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  return expires <= now + fiveMinutes
}

async function refreshMercadoPagoTokenIfPossible({
  supabase,
  account,
}: {
  supabase: any
  account: any
}) {
  const clientId = Deno.env.get('MERCADO_PAGO_CLIENT_ID')
  const clientSecret = Deno.env.get('MERCADO_PAGO_CLIENT_SECRET')

  if (!account?.refresh_token) {
    throw new Error('Token Mercado Pago vencido e sem refresh_token. Reconecte o Mercado Pago.')
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      'Token Mercado Pago vencido. Configure MERCADO_PAGO_CLIENT_ID e MERCADO_PAGO_CLIENT_SECRET ou reconecte o Mercado Pago.',
    )
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  body.set('refresh_token', account.refresh_token)

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro ao renovar token Mercado Pago:', data)
    throw new Error(data?.message || 'Erro ao renovar token Mercado Pago.')
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
    : account.expires_at

  const { data: updatedAccount, error: updateError } = await supabase
    .from('user_payment_accounts')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token || account.refresh_token,
      token_type: data.token_type || account.token_type,
      scope: data.scope || account.scope,
      live_mode:
        typeof data.live_mode === 'boolean' ? data.live_mode : account.live_mode,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id)
    .select('*')
    .single()

  if (updateError) {
    console.error('Erro ao salvar token Mercado Pago renovado:', updateError)
    throw updateError
  }

  return updatedAccount
}

async function getMercadoPagoAccountForUser({
  supabase,
  userId,
}: {
  supabase: any
  userId: string
}) {
  const { data: account, error } = await supabase
    .from('user_payment_accounts')
    .select(
      `
      id,
      user_id,
      provider,
      provider_user_id,
      public_key,
      access_token,
      refresh_token,
      token_type,
      scope,
      live_mode,
      expires_at,
      connected_at,
      updated_at
    `,
    )
    .eq('user_id', userId)
    .eq('provider', 'mercado_pago')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar conta Mercado Pago:', error)
    throw new Error(`Erro ao buscar conta Mercado Pago: ${error.message}`)
  }

  if (!account) {
    throw new Error('Usuário não possui Mercado Pago conectado.')
  }

  if (!account.access_token) {
    throw new Error('Conta Mercado Pago conectada, mas sem access_token.')
  }

  if (isExpiredOrNearExpiration(account.expires_at)) {
    return await refreshMercadoPagoTokenIfPossible({ supabase, account })
  }

  return account
}

async function createPixPayment({
  accessToken,
  mercadoPagoAccount,
  charge,
  client,
}: {
  accessToken: string
  mercadoPagoAccount: any
  charge: any
  client: any
}) {
  const amount = Number(charge.amount || 0)

  if (!amount || amount <= 0) {
    throw new Error('Valor da cobrança inválido.')
  }

  const payerEmail =
    client?.email ||
    Deno.env.get('MERCADO_PAGO_DEFAULT_PAYER_EMAIL') ||
    `cliente-${charge.id}@example.com`

  const payerPhone = onlyDigits(client?.phone)

  const body = {
    transaction_amount: amount,
    description: charge.description || 'Cobrança',
    payment_method_id: 'pix',
    external_reference: charge.id,
    notification_url: getNotificationUrl(),
    payer: {
      email: payerEmail,
      first_name: client?.name || 'Cliente',
      phone: payerPhone
        ? {
            area_code: payerPhone.slice(0, 2),
            number: payerPhone.slice(2),
          }
        : undefined,
    },
    metadata: {
      charge_id: charge.id,
      user_id: charge.user_id,
      checkout_type: 'pix',
      mercado_pago_account_id: mercadoPagoAccount.id,
      mercado_pago_provider_user_id: mercadoPagoAccount.provider_user_id,
    },
  }

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `pix-${charge.id}-${mercadoPagoAccount.provider_user_id}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro Mercado Pago Pix:', data)
    throw new Error(data?.message || data?.error || 'Erro ao criar pagamento Pix.')
  }

  const transactionData = data?.point_of_interaction?.transaction_data || {}

  return {
    mercado_pago_payment_id: String(data.id),
    mercado_pago_preference_id: null,
    checkout_type: 'pix',
    pix_qr_code: transactionData.qr_code || null,
    pix_qr_code_base64: transactionData.qr_code_base64 || null,
    payment_url: transactionData.ticket_url || null,
    mercado_pago_response: data,
  }
}

async function createCheckoutProPreference({
  accessToken,
  mercadoPagoAccount,
  charge,
  client,
}: {
  accessToken: string
  mercadoPagoAccount: any
  charge: any
  client: any
}) {
  const amount = Number(charge.amount || 0)
  const appUrl = getBaseAppUrl()

  if (!amount || amount <= 0) {
    throw new Error('Valor da cobrança inválido.')
  }

  const payerEmail =
    client?.email ||
    Deno.env.get('MERCADO_PAGO_DEFAULT_PAYER_EMAIL') ||
    undefined

  const body = {
    items: [
      {
        id: charge.id,
        title: charge.description || 'Cobrança',
        description: charge.description || 'Cobrança',
        quantity: 1,
        currency_id: 'BRL',
        unit_price: amount,
      },
    ],
    payer: {
      name: client?.name || 'Cliente',
      email: payerEmail,
    },
    external_reference: charge.id,
    notification_url: getNotificationUrl(),
    back_urls: {
      success: `${appUrl}/app/cobrancas?payment=success&charge_id=${charge.id}`,
      pending: `${appUrl}/app/cobrancas?payment=pending&charge_id=${charge.id}`,
      failure: `${appUrl}/app/cobrancas?payment=failure&charge_id=${charge.id}`,
    },
    auto_return: 'approved',
    payment_methods: {
      installments: 12,
    },
    metadata: {
      charge_id: charge.id,
      user_id: charge.user_id,
      checkout_type: 'checkout_pro',
      mercado_pago_account_id: mercadoPagoAccount.id,
      mercado_pago_provider_user_id: mercadoPagoAccount.provider_user_id,
    },
  }

  const response = await fetch(
    'https://api.mercadopago.com/checkout/preferences',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro Mercado Pago Checkout Pro:', data)
    throw new Error(data?.message || data?.error || 'Erro ao criar Checkout Mercado Pago.')
  }

  return {
    mercado_pago_payment_id: null,
    mercado_pago_preference_id: String(data.id),
    checkout_type: 'checkout_pro',
    pix_qr_code: null,
    pix_qr_code_base64: null,
    payment_url: data.init_point || data.sandbox_init_point || null,
    mercado_pago_response: data,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const { charge_id, user_id } = await req.json()

    if (!charge_id || !user_id) {
      return jsonResponse(
        {
          ok: false,
          error: 'charge_id e user_id são obrigatórios.',
        },
        400,
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select(
        `
        *,
        client:clients (
          id,
          name,
          phone,
          email
        )
      `,
      )
      .eq('id', charge_id)
      .eq('user_id', user_id)
      .single()

    if (chargeError) throw chargeError
    if (!charge) throw new Error('Cobrança não encontrada.')

    const mercadoPagoAccount = await getMercadoPagoAccountForUser({
      supabase,
      userId: charge.user_id,
    })

    const client = charge.client
    const useCheckoutPro = shouldUseCheckoutProForCharge(charge)

    console.log('Gerando pagamento Mercado Pago:', {
      charge_id: charge.id,
      user_id: charge.user_id,
      amount: charge.amount,
      mercado_pago_account_id: mercadoPagoAccount.id,
      mercado_pago_provider_user_id: mercadoPagoAccount.provider_user_id,
      live_mode: mercadoPagoAccount.live_mode,
      credit_card_enabled: charge.credit_card_enabled,
      payment_methods: charge.payment_methods,
      useCheckoutPro,
    })

    const paymentData = useCheckoutPro
      ? await createCheckoutProPreference({
          accessToken: mercadoPagoAccount.access_token,
          mercadoPagoAccount,
          charge,
          client,
        })
      : await createPixPayment({
          accessToken: mercadoPagoAccount.access_token,
          mercadoPagoAccount,
          charge,
          client,
        })

    const { data: updatedCharge, error: updateError } = await supabase
      .from('charges')
      .update({
        mercado_pago_payment_id: paymentData.mercado_pago_payment_id,
        mercado_pago_preference_id: paymentData.mercado_pago_preference_id,
        checkout_type: paymentData.checkout_type,
        pix_qr_code: paymentData.pix_qr_code,
        pix_qr_code_base64: paymentData.pix_qr_code_base64,
        payment_url: paymentData.payment_url,
        payment_provider: 'mercado_pago',
        payment_id:
          paymentData.mercado_pago_payment_id ||
          paymentData.mercado_pago_preference_id,
        payment_status: paymentData.checkout_type === 'pix' ? 'pending' : 'created',
      })
      .eq('id', charge.id)
      .eq('user_id', user_id)
      .select(
        `
        *,
        client:clients (
          id,
          name,
          phone,
          email
        )
      `,
      )
      .single()

    if (updateError) throw updateError

    return jsonResponse({
      ok: true,
      checkout_type: paymentData.checkout_type,
      mercado_pago_provider_user_id: mercadoPagoAccount.provider_user_id,
      mercado_pago_account_id: mercadoPagoAccount.id,
      mercado_pago_payment_id: paymentData.mercado_pago_payment_id,
      mercado_pago_preference_id: paymentData.mercado_pago_preference_id,
      payment_url: paymentData.payment_url,
      charge: updatedCharge,
    })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado.',
      },
      500,
    )
  }
})