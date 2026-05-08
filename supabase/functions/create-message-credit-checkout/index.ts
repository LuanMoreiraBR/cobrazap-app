import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MESSAGE_CREDIT_UNIT_PRICE = 0.25
const MIN_QUANTITY = 10
const MAX_QUANTITY = 5000

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getBaseAppUrl() {
  return (
    Deno.env.get('APP_URL') ||
    Deno.env.get('SITE_URL') ||
    'https://seu-site.vercel.app'
  )
}

function getNotificationUrl() {
  const customUrl = Deno.env.get('MERCADO_PAGO_PLATFORM_WEBHOOK_URL')

  if (customUrl) return customUrl

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  return `${supabaseUrl}/functions/v1/platform-payment-webhook`
}

function normalizeInstallments(value: unknown) {
  const installments = Number(value || 1)

  if (!Number.isFinite(installments)) return 1

  return Math.max(1, Math.min(installments, 12))
}

function normalizeQuantity(value: unknown) {
  const quantity = Math.floor(Number(value || 0))

  if (!Number.isFinite(quantity)) return 0

  return quantity
}

function calculateAmount(quantity: number) {
  return Number((quantity * MESSAGE_CREDIT_UNIT_PRICE).toFixed(2))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        error: 'Método não permitido.',
      },
      405,
    )
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

    const body = await req.json().catch(() => ({}))

    const userId = String(body.user_id || '')
    const quantity = normalizeQuantity(body.quantity)
    const installments = normalizeInstallments(body.installments)

    if (!userId) {
      return jsonResponse(
        {
          ok: false,
          error: 'user_id é obrigatório.',
        },
        400,
      )
    }

    if (quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
      return jsonResponse(
        {
          ok: false,
          error: `Quantidade inválida. Escolha entre ${MIN_QUANTITY} e ${MAX_QUANTITY} mensagens.`,
        },
        400,
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const amount = calculateAmount(quantity)

    const { data: purchase, error: purchaseError } = await supabase
      .from('message_credit_purchases')
      .insert({
        user_id: userId,
        quantity,
        remaining: 0,
        amount,
        status: 'pending',
        provider: 'mercado_pago',
      })
      .select('*')
      .single()

    if (purchaseError) throw purchaseError

    const appUrl = getBaseAppUrl()
    const returnBase = `${appUrl}/pagamento/retorno?flow=credits`

    const preferenceBody = {
      items: [
        {
          id: `message-credits-${quantity}`,
          title: `${quantity} mensagens extras - Lembrei`,
          description: `Pacote com ${quantity} mensagens extras para o Lembrei`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: amount,
        },
      ],

      external_reference: purchase.id,

      notification_url: getNotificationUrl(),

      back_urls: {
        success: `${returnBase}&status=success`,
        pending: `${returnBase}&status=pending`,
        failure: `${returnBase}&status=failure`,
      },

      auto_return: 'approved',

      payment_methods: {
        installments,
        default_installments: installments,
        excluded_payment_types: [],
        excluded_payment_methods: [],
      },

      metadata: {
        type: 'message_credit_purchase',
        checkout_type: 'message_credit_purchase',
        user_id: userId,
        purchase_id: purchase.id,
        message_credit_purchase_id: purchase.id,
        quantity,
      },
    }

    const mpResponse = await fetch(
      'https://api.mercadopago.com/checkout/preferences',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferenceBody),
      },
    )

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago compra de créditos:', mpData)
      throw new Error(
        mpData?.message || 'Erro ao criar checkout do pacote de mensagens.',
      )
    }

    const paymentUrl = mpData.init_point || mpData.sandbox_init_point || null
    const preferenceId = String(mpData.id || '')

    if (!preferenceId) {
      throw new Error('Mercado Pago não retornou preference_id.')
    }

    const { data: updatedPurchase, error: updatePurchaseError } = await supabase
      .from('message_credit_purchases')
      .update({
        mercado_pago_preference_id: preferenceId,
        payment_url: paymentUrl,
      })
      .eq('id', purchase.id)
      .select('*')
      .single()

    if (updatePurchaseError) throw updatePurchaseError

    return jsonResponse({
      ok: true,
      purchase: updatedPurchase,
      payment_url: paymentUrl,
      preference_id: preferenceId,
      quantity,
      amount,
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
