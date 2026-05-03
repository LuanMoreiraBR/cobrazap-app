import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function formatBrazilWhatsApp(phone: string) {
  const digits = onlyDigits(phone)

  if (digits.startsWith('55')) {
    return `whatsapp:+${digits}`
  }

  return `whatsapp:+55${digits}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

async function getPayment(paymentId: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${getEnv('MERCADO_PAGO_ACCESS_TOKEN')}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Erro ao consultar pagamento: ${JSON.stringify(data)}`)
  }

  return data
}

async function sendWithTwilio({ to, text }: { to: string; text: string }) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const from = getEnv('TWILIO_WHATSAPP_FROM')

  const body = new URLSearchParams()
  body.set('From', from)
  body.set('To', to)
  body.set('Body', text)

  const auth = btoa(`${accountSid}:${authToken}`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Erro Twilio: ${JSON.stringify(data)}`)
  }

  return data
}

function buildPaymentConfirmationMessage(charge: any) {
  const clientName = charge.client?.name || 'cliente'
  const description = charge.description || 'cobrança'
  const amount = formatCurrency(charge.amount)

  return `Olá ${clientName}, tudo bem?

Pagamento recebido com sucesso! ✅

Referente à cobrança: "${description}"
Valor: ${amount}

Muito obrigado!`
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}))

    const paymentId =
      payload?.data?.id ||
      new URL(req.url).searchParams.get('data.id') ||
      new URL(req.url).searchParams.get('id')

    if (!paymentId) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payment = await getPayment(String(paymentId))

    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const chargeId = payment.external_reference

    if (!chargeId) {
      return new Response(
        JSON.stringify({ ok: true, no_external_reference: true }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const isPaid = payment.status === 'approved'

    const { data: chargeBeforeUpdate, error: chargeFetchError } = await supabase
      .from('charges')
      .select(`
        *,
        client:clients (
          id,
          name,
          phone
        )
      `)
      .eq('id', chargeId)
      .single()

    if (chargeFetchError) throw chargeFetchError

    const wasAlreadyPaid = chargeBeforeUpdate?.status === 'pago'

   const { error: updateChargeError } = await supabase
  .from('charges')
  .update({
    payment_provider: 'mercado_pago',
    payment_id: String(payment.id),
    payment_status: payment.status,
    mercado_pago_payment_id: String(payment.id),
    status: isPaid ? 'pago' : chargeBeforeUpdate?.status,
    paid_at: isPaid
      ? chargeBeforeUpdate?.paid_at || new Date().toISOString()
      : chargeBeforeUpdate?.paid_at,
  })
  .eq('id', chargeId)

    if (updateChargeError) throw updateChargeError

    if (isPaid) {
      const { error: cancelMessagesError } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'cancelled',
          error_message: 'Cobrança paga via Mercado Pago.',
        })
        .eq('charge_id', chargeId)
        .eq('status', 'pending')

      if (cancelMessagesError) throw cancelMessagesError

      if (!wasAlreadyPaid && chargeBeforeUpdate?.client?.phone) {
        await sendWithTwilio({
          to: formatBrazilWhatsApp(chargeBeforeUpdate.client.phone),
          text: buildPaymentConfirmationMessage(chargeBeforeUpdate),
        })
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        payment_id: payment.id,
        status: payment.status,
        charge_id: chargeId,
        confirmation_sent: isPaid && !wasAlreadyPaid,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
})