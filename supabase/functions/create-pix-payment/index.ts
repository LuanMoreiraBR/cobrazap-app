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

async function createPixPayment({
  accessToken,
  charge,
  client,
}: {
  accessToken: string
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
    },
  }

  const response = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `pix-${charge.id}-${Date.now()}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro Mercado Pago Pix:', data)
    throw new Error(data?.message || 'Erro ao criar pagamento Pix.')
  }

  const transactionData = data?.point_of_interaction?.transaction_data || {}

  return {
    mercado_pago_payment_id: String(data.id),
    mercado_pago_preference_id: null,
    checkout_type: 'pix',
    pix_qr_code: transactionData.qr_code || null,
    pix_qr_code_base64: transactionData.qr_code_base64 || null,
    payment_url: transactionData.ticket_url || null,
  }
}

async function createCheckoutProPreference({
  accessToken,
  charge,
  client,
}: {
  accessToken: string
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
    throw new Error(data?.message || 'Erro ao criar Checkout Mercado Pago.')
  }

  return {
    mercado_pago_payment_id: null,
    mercado_pago_preference_id: String(data.id),
    checkout_type: 'checkout_pro',
    pix_qr_code: null,
    pix_qr_code_base64: null,
    payment_url: data.init_point || data.sandbox_init_point || null,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
    }

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

    const client = charge.client

    const useCheckoutPro = shouldUseCheckoutProForCharge(charge)

    console.log('Gerando pagamento Mercado Pago:', {
      charge_id: charge.id,
      amount: charge.amount,
      credit_card_enabled: charge.credit_card_enabled,
      payment_methods: charge.payment_methods,
      useCheckoutPro,
    })

    const paymentData = useCheckoutPro
      ? await createCheckoutProPreference({
          accessToken,
          charge,
          client,
        })
      : await createPixPayment({
          accessToken,
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