import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function formatCurrencyBRL(amount: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(amount || 0))
}

function onlyDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function formatWhatsAppTo(phone: string | null | undefined) {
  const digits = onlyDigits(phone)

  if (!digits) return ''

  const phoneWithCountryCode = digits.startsWith('55') ? digits : `55${digits}`

  return `whatsapp:+${phoneWithCountryCode}`
}

function isExpiredOrNearExpiration(expiresAt: string | null | undefined) {
  if (!expiresAt) return false

  const expires = new Date(expiresAt).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  return expires <= now + fiveMinutes
}

async function refreshMercadoPagoToken({
  supabase,
  account,
}: {
  supabase: any
  account: any
}) {
  const clientId = Deno.env.get('MERCADO_PAGO_CLIENT_ID')
  const clientSecret = Deno.env.get('MERCADO_PAGO_CLIENT_SECRET')

  if (!account?.refresh_token || !clientId || !clientSecret) {
    throw new Error('Token Mercado Pago vencido e não é possível renovar. Usuário precisa reconectar.')
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  body.set('refresh_token', account.refresh_token)

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const data = await response.json()

  if (!response.ok) {
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
      live_mode: typeof data.live_mode === 'boolean' ? data.live_mode : account.live_mode,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', account.id)
    .select('*')
    .single()

  if (updateError) throw updateError

  return updatedAccount
}

async function getAccountByMpUserId({
  supabase,
  mpUserId,
}: {
  supabase: any
  mpUserId: string
}) {
  const { data: account, error } = await supabase
    .from('user_payment_accounts')
    .select('*')
    .eq('provider_user_id', mpUserId)
    .eq('provider', 'mercado_pago')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Erro ao buscar conta MP: ${error.message}`)

  return account ?? null
}

async function getAccountByPaymentId({
  supabase,
  paymentId,
}: {
  supabase: any
  paymentId: string
}) {
  const { data: charge, error } = await supabase
    .from('charges')
    .select('user_id')
    .eq('mercado_pago_payment_id', paymentId)
    .limit(1)
    .maybeSingle()

  if (error || !charge?.user_id) return null

  const { data: account } = await supabase
    .from('user_payment_accounts')
    .select('*')
    .eq('user_id', charge.user_id)
    .eq('provider', 'mercado_pago')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  return account ?? null
}

async function resolveAccessToken({
  supabase,
  mpUserId,
  paymentId,
}: {
  supabase: any
  mpUserId: string
  paymentId: string
}) {
  // Tenta pelo user_id do MP (formato webhook novo)
  let account = mpUserId
    ? await getAccountByMpUserId({ supabase, mpUserId })
    : null

  // Fallback: busca pela cobrança com esse payment_id (formato IPN antigo)
  if (!account?.access_token) {
    account = await getAccountByPaymentId({ supabase, paymentId })
  }

  if (!account?.access_token) {
    throw new Error(
      `Conta Mercado Pago não encontrada. mpUserId=${mpUserId}, paymentId=${paymentId}`,
    )
  }

  if (isExpiredOrNearExpiration(account.expires_at)) {
    const refreshed = await refreshMercadoPagoToken({ supabase, account })
    return refreshed.access_token as string
  }

  return account.access_token as string
}

async function getPaymentFromMercadoPago(paymentId: string, accessToken: string) {
  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro ao buscar pagamento Mercado Pago:', data)
    throw new Error(data?.message || 'Erro ao buscar pagamento no Mercado Pago.')
  }

  return data
}

function getPaymentIdFromRequest(url: URL, body: any) {
  const queryDataId = url.searchParams.get('data.id')
  const queryId = url.searchParams.get('id')
  const queryResource = url.searchParams.get('resource')

  const bodyDataId = body?.data?.id
  const bodyId = body?.id
  const bodyResource = body?.resource

  const resource = String(queryResource || bodyResource || '')

  if (resource.includes('/v1/payments/')) {
    return resource.split('/v1/payments/')[1]
  }

  return String(queryDataId || bodyDataId || queryId || bodyId || '')
}

function getEventType(url: URL, body: any) {
  return String(
    body?.type ||
      body?.topic ||
      body?.action ||
      url.searchParams.get('type') ||
      url.searchParams.get('topic') ||
      '',
  )
}

function shouldIgnoreEventType(type: string) {
  if (!type) return false

  const normalized = type.toLowerCase()

  if (normalized.includes('payment')) return false

  return true
}

function getChargeIdFromPayment(payment: any) {
  return String(
    payment?.external_reference ||
      payment?.metadata?.charge_id ||
      payment?.additional_info?.external_reference ||
      '',
  )
}

function buildPaymentConfirmationMessage({
  clientName,
  description,
  amount,
}: {
  clientName: string
  description: string
  amount: number | string
}) {
  const value = formatCurrencyBRL(amount)

  return `Olá ${clientName}, tudo bem?

Pagamento recebido com sucesso! ✅

Referente à cobrança: "${description}"
Valor: ${value}

Muito obrigado!`
}

async function sendTwilioWhatsAppMessage({
  to,
  body,
}: {
  to: string
  body: string
}) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')

  if (!accountSid || !authToken || !messagingServiceSid) {
    console.error('Twilio não configurado.', {
      hasAccountSid: Boolean(accountSid),
      hasAuthToken: Boolean(authToken),
      hasMessagingServiceSid: Boolean(messagingServiceSid),
    })

    throw new Error('Twilio não configurado para envio de confirmação.')
  }

  if (!to) {
    throw new Error('Telefone do cliente vazio. Confirmação não enviada.')
  }

  const credentials = btoa(`${accountSid}:${authToken}`)

  const params = new URLSearchParams()
  params.set('MessagingServiceSid', messagingServiceSid)
  params.set('To', to)
  params.set('Body', body)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    },
  )

  const data = await response.json()

  if (!response.ok) {
    console.error('Erro ao enviar confirmação Twilio:', data)
    throw new Error(data?.message || 'Erro ao enviar confirmação pelo WhatsApp.')
  }

  return {
    skipped: false,
    sid: data.sid,
    status: data.status,
  }
}

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const url = new URL(req.url)

    let body: any = {}

    try {
      body = await req.json()
    } catch {
      body = {}
    }

    console.log('Webhook Mercado Pago recebido:', {
      query: Object.fromEntries(url.searchParams.entries()),
      body,
    })

    const eventType = getEventType(url, body)

    if (shouldIgnoreEventType(eventType)) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: `Evento ignorado: ${eventType}`,
      })
    }

    const paymentId = getPaymentIdFromRequest(url, body)

    if (!paymentId) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Sem paymentId.',
      })
    }

    // ID do usuário no Mercado Pago — presente no formato webhook novo, ausente no IPN antigo
    const mpUserId = String(body?.user_id || '')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Resolve o access_token correto: tenta por mpUserId, depois pelo payment_id na tabela de cobranças
    const accessToken = await resolveAccessToken({ supabase, mpUserId, paymentId })

    const payment = await getPaymentFromMercadoPago(paymentId, accessToken)
    const chargeId = getChargeIdFromPayment(payment)

    if (!chargeId) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Pagamento sem external_reference/charge_id.',
        payment_id: payment.id,
        payment_status: payment.status,
      })
    }

    const { data: chargeBeforeUpdate, error: chargeBeforeUpdateError } =
      await supabase
        .from('charges')
        .select(
          `
          id,
          user_id,
          client_id,
          description,
          amount,
          status,
          paid_at,
          payment_status,
          mercado_pago_payment_id,
          client:clients (
            id,
            name,
            phone
          )
        `,
        )
        .eq('id', chargeId)
        .single()

    if (chargeBeforeUpdateError) throw chargeBeforeUpdateError

    if (!chargeBeforeUpdate) {
      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Cobrança não encontrada.',
        charge_id: chargeId,
        payment_id: payment.id,
      })
    }

    const isApproved = payment.status === 'approved'
    const alreadyPaid = chargeBeforeUpdate.status === 'pago'

    if (isApproved && alreadyPaid) {
      console.log('Cobrança já estava paga. Ignorando confirmação duplicada.', {
        charge_id: chargeId,
        payment_id: payment.id,
      })

      return jsonResponse({
        ok: true,
        ignored: true,
        reason: 'Cobrança já estava paga. Confirmação não reenviada.',
        charge_id: chargeId,
        payment_id: payment.id,
        payment_status: payment.status,
      })
    }

    const { error: updateChargeError } = await supabase
      .from('charges')
      .update({
        payment_provider: 'mercado_pago',
        payment_id: String(payment.id),
        payment_status: payment.status,
        mercado_pago_payment_id: String(payment.id),
        status: isApproved ? 'pago' : chargeBeforeUpdate.status,
        paid_at: isApproved
          ? chargeBeforeUpdate.paid_at || new Date().toISOString()
          : chargeBeforeUpdate.paid_at,
      })
      .eq('id', chargeId)

    if (updateChargeError) throw updateChargeError

    let processedEventInserted = false

    if (isApproved) {
      const { error: processedEventError } = await supabase
        .from('processed_payment_events')
        .insert({
          provider: 'mercado_pago',
          payment_id: String(payment.id),
          charge_id: chargeId,
          event_status: payment.status,
        })

      if (processedEventError) {
        if (String(processedEventError.code) === '23505') {
          console.log('Evento Mercado Pago já processado. Ignorando duplicado.', {
            charge_id: chargeId,
            payment_id: payment.id,
            payment_status: payment.status,
          })

          return jsonResponse({
            ok: true,
            ignored: true,
            reason: 'Evento já processado anteriormente. Confirmação não reenviada.',
            charge_id: chargeId,
            payment_id: payment.id,
            payment_status: payment.status,
          })
        }

        throw processedEventError
      }

      processedEventInserted = true
    }

    let twilioResult: any = null
    let pushResult: any = null

    if (isApproved && processedEventInserted) {
      const { error: scheduledError } = await supabase
        .from('scheduled_messages')
        .update({
          status: 'cancelled',
          error_message: 'Cobrança paga via Mercado Pago.',
        })
        .eq('charge_id', chargeId)
        .eq('status', 'pending')

      if (scheduledError) throw scheduledError

      const client = Array.isArray(chargeBeforeUpdate.client)
        ? chargeBeforeUpdate.client[0]
        : chargeBeforeUpdate.client

      const to = formatWhatsAppTo(client?.phone)
      const confirmationMessage = buildPaymentConfirmationMessage({
        clientName: client?.name || 'cliente',
        description: chargeBeforeUpdate.description || 'cobrança',
        amount: chargeBeforeUpdate.amount || 0,
      })

      twilioResult = await sendTwilioWhatsAppMessage({
        to,
        body: confirmationMessage,
      })

      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: chargeBeforeUpdate.user_id,
            title: 'Pagamento recebido! ✅',
            body: `${client?.name || 'Cliente'} pagou ${formatCurrencyBRL(chargeBeforeUpdate.amount)}`,
            url: '/app/cobrancas',
          }),
        })
      } catch (pushErr) {
        console.error('Erro ao enviar push notification:', pushErr)
      }
    }

    return jsonResponse({
      ok: true,
      charge_id: chargeId,
      payment_id: payment.id,
      payment_status: payment.status,
      charge_status: isApproved ? 'pago' : chargeBeforeUpdate.status,
      confirmation_sent: Boolean(
        isApproved &&
          processedEventInserted &&
          twilioResult &&
          !twilioResult.skipped,
      ),
      twilio: twilioResult,
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
