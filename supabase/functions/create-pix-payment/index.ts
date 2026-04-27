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

function buildPayerEmail() {
  return "teste@usepaguei.com.br"
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { charge_id, user_id } = await req.json()

    if (!charge_id) throw new Error('charge_id não informado.')
    if (!user_id) throw new Error('user_id não informado.')

    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const { data: charge, error: chargeError } = await supabase
      .from('charges')
      .select(`
        *,
        client:clients (
          id,
          name,
          phone
        )
      `)
      .eq('id', charge_id)
      .eq('user_id', user_id)
      .single()

    if (chargeError) throw chargeError
    if (!charge) throw new Error('Cobrança não encontrada.')
    if (charge.status === 'pago') throw new Error('Cobrança já está paga.')

    if (charge.payment_id && charge.pix_qr_code) {
      return new Response(
        JSON.stringify({
          ok: true,
          reused: true,
          charge,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: paymentAccount, error: paymentAccountError } = await supabase
  .from('user_payment_accounts')
  .select('access_token, provider_user_id')
  .eq('user_id', user_id)
  .eq('provider', 'mercado_pago')
  .single()

if (paymentAccountError || !paymentAccount?.access_token) {
  throw new Error('Conecte sua conta Mercado Pago em Configurações antes de gerar Pix.')
}

const accessToken = paymentAccount.access_token

    const paymentPayload = {
      transaction_amount: Number(charge.amount),
      description: charge.description || 'Cobrança Lembrei',
      payment_method_id: 'pix',
      external_reference: charge.id,
      notification_url:
        `${getEnv('SUPABASE_URL')}/functions/v1/mercado-pago-webhook`,
      payer: {
        email: buildPayerEmail(),
        first_name: charge.client?.name || 'Cliente',
      },
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': charge.id,
      },
      body: JSON.stringify(paymentPayload),
    })

    const payment = await response.json()

    if (!response.ok) {
      throw new Error(`Erro Mercado Pago: ${JSON.stringify(payment)}`)
    }

    const transactionData = payment.point_of_interaction?.transaction_data || {}

    const { data: updatedCharge, error: updateError } = await supabase
      .from('charges')
      .update({
        payment_provider: 'mercado_pago',
        payment_id: String(payment.id),
        payment_status: payment.status || 'pending',
        pix_qr_code: transactionData.qr_code || null,
        pix_qr_code_base64: transactionData.qr_code_base64 || null,
        payment_url: transactionData.ticket_url || null,
      })
      .eq('id', charge.id)
      .eq('user_id', user_id)
      .select(`
        *,
        client:clients (
          id,
          name,
          phone
        )
      `)
      .single()

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({
        ok: true,
        reused: false,
        charge: updatedCharge,
        payment,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})