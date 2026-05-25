import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SESSION_EXPIRATION_MINUTES = 15
const MAX_CHARGES_TO_LIST = 12

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function getEnv(name: string) {
  const value = Deno.env.get(name)

  if (!value) {
    throw new Error(`Variável ${name} não configurada.`)
  }

  return value
}

function onlyDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeBrazilPhoneDigits(value: string | null | undefined) {
  const digits = onlyDigits(value)

  if (!digits) return ''

  if (digits.startsWith('55')) return digits

  return `55${digits}`
}

function removeBrazilCountryCode(value: string | null | undefined) {
  const digits = onlyDigits(value)

  if (digits.startsWith('55')) return digits.slice(2)

  return digits
}

function last4(value: string | null | undefined) {
  const digits = onlyDigits(value)
  return digits.slice(-4)
}

function escapeXml(value: string | null | undefined) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function twiml(message: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
      message,
    )}</Message></Response>`,
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml; charset=utf-8',
      },
    },
  )
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

function formatCurrencyBRL(amount: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(amount || 0))
}

function formatDateBR(dateString: string | null | undefined) {
  if (!dateString) return '-'

  const date = new Date(`${dateString}T00:00:00`)

  return new Intl.DateTimeFormat('pt-BR').format(date)
}

function cleanDescription(description: string | null | undefined) {
  return String(description || 'cobrança')
    .replace(/\s*-\s*Parcela\s+\d+\/\d+$/i, '')
    .replace(/\s*-\s*Recorrência\s+\d+\/\d+$/i, '')
    .trim()
}

function getChargeLabel(charge: any, index: number) {
  const description = cleanDescription(charge.description)
  const amount = formatCurrencyBRL(charge.amount)
  const dueDate = formatDateBR(charge.due_date)

  let type = ''

  if (charge.payment_type === 'installment') {
    type = `Parcela ${charge.installment_number}/${charge.installment_total}`
  } else if (charge.recurrence_type === 'monthly') {
    type = `Recorrência ${charge.recurrence_number}/${charge.recurrence_total}`
  }

  const typeText = type ? ` - ${type}` : ''

  return `${index + 1}) ${description}${typeText}\nValor: ${amount}\nVencimento: ${dueDate}`
}

function getPaymentText(charge: any) {
  const description = cleanDescription(charge.description)
  const amount = formatCurrencyBRL(charge.amount)
  const dueDate = formatDateBR(charge.due_date)

  if (charge.payment_url) {
    return `Segue sua cobrança:

${description}
Valor: ${amount}
Vencimento: ${dueDate}

Para pagar, acesse o link seguro:
${charge.payment_url}

Após pagar, responda PAGO nesta conversa para consultar a confirmação.`
  }

  if (charge.pix_qr_code) {
    return `Segue sua cobrança:

${description}
Valor: ${amount}
Vencimento: ${dueDate}

Pix copia e cola:
${charge.pix_qr_code}

Após pagar, responda PAGO nesta conversa para consultar a confirmação.`
  }

  return `Encontrei a cobrança, mas o pagamento ainda não foi gerado. Entre em contato com o responsável pela cobrança.`
}

function isGreeting(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  return [
    'oi',
    'ola',
    'olá',
    'bom dia',
    'boa tarde',
    'boa noite',
    'menu',
    'pagamento',
    'pagar',
    'cobranca',
    'cobrança',
    'boleto',
    'pix',
  ].includes(normalized)
}

function wantsPaidConfirmation(text: string) {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  return ['pago', 'ja paguei', 'já paguei', 'paguei', 'confirmar pagamento'].includes(
    normalized,
  )
}

function getSessionExpirationIso() {
  return new Date(
    Date.now() + SESSION_EXPIRATION_MINUTES * 60 * 1000,
  ).toISOString()
}

async function logPlatformEvent({
  supabase,
  provider = 'twilio',
  eventType,
  userId = null,
  relatedTable = null,
  relatedId = null,
  status = 'info',
  message = '',
  requestPayload = {},
  responsePayload = {},
  errorMessage = null,
}: {
  supabase: any
  provider?: string
  eventType: string
  userId?: string | null
  relatedTable?: string | null
  relatedId?: string | null
  status?: string
  message?: string
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  errorMessage?: string | null
}) {
  try {
    await supabase.from('platform_event_logs').insert({
      provider,
      event_type: eventType,
      user_id: userId,
      related_table: relatedTable,
      related_id: relatedId,
      status,
      message,
      request_payload: requestPayload,
      response_payload: responsePayload,
      error_message: errorMessage,
    })
  } catch (error) {
    console.error('Erro ao gravar platform_event_logs:', error)
  }
}

async function readTwilioPayload(req: Request) {
  const contentType = req.headers.get('Content-Type') || ''

  if (contentType.includes('application/json')) {
    return await req.json()
  }

  const text = await req.text()
  const params = new URLSearchParams(text)

  return Object.fromEntries(params.entries())
}

async function findMatchingClients(supabase: any, fromPhoneDigitsWith55: string) {
  const without55 = removeBrazilCountryCode(fromPhoneDigitsWith55)
  const last11 = without55.slice(-11)
  const last10 = without55.slice(-10)
  const last9 = without55.slice(-9)
  const last8 = without55.slice(-8)

  const filters = [
    `phone_digits.eq.${fromPhoneDigitsWith55}`,
    `phone_digits.eq.${without55}`,
    `phone_digits.eq.${last11}`,
    `phone_digits.eq.${last10}`,
  ]

  if (last9) {
    filters.push(`phone_digits.like.%${last9}`)
  }

  if (last8) {
    filters.push(`phone_digits.like.%${last8}`)
  }

  const { data, error } = await supabase
    .from('clients')
    .select(
      `
      id,
      user_id,
      name,
      phone,
      phone_digits
    `,
    )
    .or(filters.join(','))

  if (error) throw error

  return data || []
}

async function getLatestSession(supabase: any, fromPhoneDigitsWith55: string) {
  const { data, error } = await supabase
    .from('inbound_whatsapp_sessions')
    .select('*')
    .eq('from_phone_digits', fromPhoneDigitsWith55)
    .gt('expires_at', new Date().toISOString())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data
}

async function upsertSession({
  supabase,
  fromPhone,
  fromPhoneDigits,
  userId,
  clientId,
  state,
  metadata = {},
  selectedChargeId = null,
}: {
  supabase: any
  fromPhone: string
  fromPhoneDigits: string
  userId?: string | null
  clientId?: string | null
  state: string
  metadata?: Record<string, unknown>
  selectedChargeId?: string | null
}) {
  const { data, error } = await supabase
    .from('inbound_whatsapp_sessions')
    .insert({
      from_phone: fromPhone,
      from_phone_digits: fromPhoneDigits,
      user_id: userId || null,
      client_id: clientId || null,
      state,
      selected_charge_id: selectedChargeId,
      metadata,
      expires_at: getSessionExpirationIso(),
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) throw error

  return data
}

async function updateSession({
  supabase,
  sessionId,
  state,
  metadata,
  selectedChargeId,
}: {
  supabase: any
  sessionId: string
  state?: string
  metadata?: Record<string, unknown>
  selectedChargeId?: string | null
}) {
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    expires_at: getSessionExpirationIso(),
  }

  if (state) updatePayload.state = state
  if (metadata) updatePayload.metadata = metadata
  if (selectedChargeId !== undefined) {
    updatePayload.selected_charge_id = selectedChargeId
  }

  const { data, error } = await supabase
    .from('inbound_whatsapp_sessions')
    .update(updatePayload)
    .eq('id', sessionId)
    .select('*')
    .single()

  if (error) throw error

  return data
}

async function getOpenChargesForClient({
  supabase,
  userId,
  clientId,
}: {
  supabase: any
  userId: string
  clientId: string
}) {
  const { data, error } = await supabase
    .from('charges')
    .select(
      `
      id,
      user_id,
      client_id,
      description,
      amount,
      due_date,
      status,
      payment_status,
      payment_url,
      pix_qr_code,
      payment_type,
      installment_number,
      installment_total,
      recurrence_type,
      recurrence_number,
      recurrence_total,
      created_at
    `,
    )
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .neq('status', 'pago')
    .order('due_date', { ascending: true })
    .limit(MAX_CHARGES_TO_LIST)

  if (error) throw error

  return data || []
}

async function getOpenChargesForPairs({
  supabase,
  clientPairs,
}: {
  supabase: any
  clientPairs: Array<{ user_id: string; client_id: string }>
}) {
  const results = await Promise.all(
    clientPairs.map(({ user_id, client_id }) =>
      getOpenChargesForClient({ supabase, userId: user_id, clientId: client_id }),
    ),
  )

  const allCharges = results.flat()

  allCharges.sort((a: any, b: any) => {
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return a.due_date < b.due_date ? -1 : 1
  })

  return allCharges.slice(0, MAX_CHARGES_TO_LIST)
}

async function handlePaidConfirmation({
  supabase,
  clientPairs,
}: {
  supabase: any
  clientPairs: Array<{ user_id: string; client_id: string }>
}) {
  const charges = await getOpenChargesForPairs({ supabase, clientPairs })

  if (!charges.length) {
    return `Não encontrei cobranças em aberto para este cadastro.

Se você pagou recentemente, a confirmação pode levar alguns instantes.`
  }

  const paidLike = charges.filter((charge: any) => {
    const paymentStatus = String(charge.payment_status || '').toLowerCase()
    return ['paid', 'approved', 'pago'].includes(paymentStatus)
  })

  if (paidLike.length) {
    return `Recebemos uma confirmação de pagamento para sua cobrança.

Se precisar, responda MENU para consultar outras cobranças.`
  }

  return `Ainda não encontrei a confirmação automática do pagamento.

Se você acabou de pagar, aguarde alguns instantes e responda PAGO novamente.

Para ver suas cobranças em aberto, responda MENU.`
}

async function buildChargesMenu({
  supabase,
  session,
}: {
  supabase: any
  session: any
}) {
  const pairs: Array<{ user_id: string; client_id: string }> =
    Array.isArray(session.metadata?.client_pairs) && session.metadata.client_pairs.length
      ? session.metadata.client_pairs
      : session.user_id && session.client_id
        ? [{ user_id: session.user_id, client_id: session.client_id }]
        : []

  const charges = await getOpenChargesForPairs({ supabase, clientPairs: pairs })

  if (!charges.length) {
    await updateSession({
      supabase,
      sessionId: session.id,
      state: 'done',
      metadata: {
        ...(session.metadata || {}),
        last_action: 'no_open_charges',
      },
    })

    return `Não encontrei cobranças em aberto para este cadastro.

Se você acredita que há uma cobrança pendente, entre em contato com o responsável.`
  }

  if (charges.length === 1) {
    await updateSession({
      supabase,
      sessionId: session.id,
      state: 'done',
      selectedChargeId: charges[0].id,
      metadata: {
        ...(session.metadata || {}),
        charge_ids: charges.map((charge: any) => charge.id),
      },
    })

    return getPaymentText(charges[0])
  }

  await updateSession({
    supabase,
    sessionId: session.id,
    state: 'selecting_charge',
    metadata: {
      ...(session.metadata || {}),
      charge_ids: charges.map((charge: any) => charge.id),
    },
  })

  const list = charges
    .map((charge: any, index: number) => getChargeLabel(charge, index))
    .join('\n\n')

  return `Encontrei mais de uma cobrança em aberto.

Digite o número da cobrança que deseja pagar:

${list}`
}

async function handleNewConversation({
  supabase,
  fromPhone,
  fromPhoneDigits,
  bodyText,
  requestPayload,
}: {
  supabase: any
  fromPhone: string
  fromPhoneDigits: string
  bodyText: string
  requestPayload: Record<string, unknown>
}) {
  const matchingClients = await findMatchingClients(supabase, fromPhoneDigits)

  if (!matchingClients.length) {
    await logPlatformEvent({
      supabase,
      eventType: 'inbound_whatsapp_unknown_phone',
      status: 'ignored',
      message: 'Mensagem recebida de telefone não cadastrado.',
      requestPayload,
      responsePayload: {
        from_phone: fromPhone,
        from_phone_digits: fromPhoneDigits,
      },
    })

    return `Olá! Não encontrei este WhatsApp cadastrado em nenhuma cobrança do Lembrei.

Verifique se está falando pelo mesmo número cadastrado com o cobrador.`
  }

  if (matchingClients.length > 1) {
    const firstClient = matchingClients[0]
    const clientPairs = matchingClients.map((c: any) => ({ user_id: c.user_id, client_id: c.id }))

    const session = await upsertSession({
      supabase,
      fromPhone,
      fromPhoneDigits,
      state: 'waiting_phone_confirmation',
      metadata: {
        client_name: firstClient.name,
        client_phone_digits: normalizeBrazilPhoneDigits(firstClient.phone_digits || firstClient.phone),
        client_pairs: clientPairs,
      },
    })

    await logPlatformEvent({
      supabase,
      eventType: 'inbound_whatsapp_multiple_clients',
      status: 'info',
      message: 'Telefone encontrado em mais de um cadastro. Cobranças agregadas.',
      relatedTable: 'inbound_whatsapp_sessions',
      relatedId: session.id,
      requestPayload,
      responsePayload: { count: matchingClients.length },
    })

    return `Olá, ${firstClient.name}.

Para sua segurança, confirme os 4 últimos números do seu celular cadastrado.`
  }

  const client = matchingClients[0]

  const session = await upsertSession({
    supabase,
    fromPhone,
    fromPhoneDigits,
    userId: client.user_id,
    clientId: client.id,
    state: 'waiting_phone_confirmation',
    metadata: {
      client_name: client.name,
      client_phone_digits: normalizeBrazilPhoneDigits(client.phone_digits || client.phone),
    },
  })

  await logPlatformEvent({
    supabase,
    eventType: 'inbound_whatsapp_confirmation_requested',
    userId: client.user_id,
    relatedTable: 'inbound_whatsapp_sessions',
    relatedId: session.id,
    status: 'info',
    message: 'Robô pediu confirmação dos 4 últimos dígitos.',
    requestPayload,
  })

  return `Olá, ${client.name}.

Para sua segurança, confirme os 4 últimos números do seu celular cadastrado.`
}

async function handleClientChoice({
  supabase,
  session,
  bodyText,
}: {
  supabase: any
  session: any
  bodyText: string
}) {
  const selectedIndex = Number(onlyDigits(bodyText)) - 1
  const candidateClientIds = Array.isArray(session.metadata?.candidate_client_ids)
    ? session.metadata.candidate_client_ids
    : []

  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= candidateClientIds.length
  ) {
    return `Não entendi a opção.

Digite apenas o número do cadastro que deseja consultar.`
  }

  const selectedClientId = candidateClientIds[selectedIndex]

  const { data: client, error } = await supabase
    .from('clients')
    .select('id, user_id, name, phone, phone_digits')
    .eq('id', selectedClientId)
    .maybeSingle()

  if (error) throw error

  if (!client) {
    return `Não consegui localizar o cadastro selecionado. Responda MENU para começar novamente.`
  }

  const updatedSession = await updateSession({
    supabase,
    sessionId: session.id,
    state: 'waiting_phone_confirmation',
    metadata: {
      ...(session.metadata || {}),
      selected_client_id: client.id,
      client_name: client.name,
      client_phone_digits: normalizeBrazilPhoneDigits(client.phone_digits || client.phone),
    },
  })

  await supabase
    .from('inbound_whatsapp_sessions')
    .update({
      user_id: client.user_id,
      client_id: client.id,
    })
    .eq('id', session.id)

  return `Certo, ${client.name}.

Para sua segurança, confirme os 4 últimos números do seu celular cadastrado.`
}

async function handlePhoneConfirmation({
  supabase,
  session,
  bodyText,
}: {
  supabase: any
  session: any
  bodyText: string
}) {
  const typedLast4 = last4(bodyText)
  const expectedLast4 = last4(
    session.metadata?.client_phone_digits || session.from_phone_digits,
  )

  if (!typedLast4 || typedLast4 !== expectedLast4) {
    return `Os 4 últimos números não conferem.

Tente novamente digitando apenas os 4 últimos números do celular cadastrado.`
  }

  const updatedSession = await updateSession({
    supabase,
    sessionId: session.id,
    state: 'confirmed',
    metadata: {
      ...(session.metadata || {}),
      confirmed_at: new Date().toISOString(),
    },
  })

  return await buildChargesMenu({
    supabase,
    session: updatedSession,
  })
}

async function handleChargeSelection({
  supabase,
  session,
  bodyText,
}: {
  supabase: any
  session: any
  bodyText: string
}) {
  const selectedIndex = Number(onlyDigits(bodyText)) - 1
  const chargeIds = Array.isArray(session.metadata?.charge_ids)
    ? session.metadata.charge_ids
    : []

  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= chargeIds.length
  ) {
    return `Não entendi a opção.

Digite apenas o número da cobrança que deseja pagar.`
  }

  const selectedChargeId = chargeIds[selectedIndex]

  const { data: charge, error } = await supabase
    .from('charges')
    .select(
      `
      id,
      user_id,
      client_id,
      description,
      amount,
      due_date,
      status,
      payment_status,
      payment_url,
      pix_qr_code,
      payment_type,
      installment_number,
      installment_total,
      recurrence_type,
      recurrence_number,
      recurrence_total
    `,
    )
    .eq('id', selectedChargeId)
    .maybeSingle()

  if (error) throw error

  const validPairs: Array<{ user_id: string; client_id: string }> =
    Array.isArray(session.metadata?.client_pairs) && session.metadata.client_pairs.length
      ? session.metadata.client_pairs
      : session.user_id && session.client_id
        ? [{ user_id: session.user_id, client_id: session.client_id }]
        : []

  const isValid =
    charge &&
    validPairs.some(
      (p) => p.user_id === charge.user_id && p.client_id === charge.client_id,
    )

  if (!isValid) {
    return `Não consegui localizar essa cobrança. Responda MENU para consultar novamente.`
  }

  await updateSession({
    supabase,
    sessionId: session.id,
    state: 'done',
    selectedChargeId: charge.id,
  })

  return getPaymentText(charge)
}

Deno.serve(async (req) => {
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

  let supabase: any = null
  let requestPayload: Record<string, unknown> = {}

  try {
    supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    requestPayload = await readTwilioPayload(req)

    const fromPhone = String(requestPayload.From || '')
    const bodyText = String(requestPayload.Body || '').trim()
    const messageSid = String(requestPayload.MessageSid || requestPayload.SmsSid || '')

    const fromPhoneDigits = normalizeBrazilPhoneDigits(fromPhone)

    if (!fromPhoneDigits) {
      return twiml('Não consegui identificar seu telefone. Tente novamente mais tarde.')
    }

    await logPlatformEvent({
      supabase,
      eventType: 'inbound_whatsapp_received',
      status: 'info',
      message: 'Mensagem recebida no WhatsApp do Lembrei.',
      requestPayload,
      responsePayload: {
        from_phone: fromPhone,
        from_phone_digits: fromPhoneDigits,
        body: bodyText,
        message_sid: messageSid,
      },
    })

    let session = await getLatestSession(supabase, fromPhoneDigits)

    if (!session || isGreeting(bodyText)) {
      const responseText = await handleNewConversation({
        supabase,
        fromPhone,
        fromPhoneDigits,
        bodyText,
        requestPayload,
      })

      return twiml(responseText)
    }

    if (session.state === 'waiting_client_choice') {
      const responseText = await handleClientChoice({
        supabase,
        session,
        bodyText,
      })

      return twiml(responseText)
    }

    if (session.state === 'waiting_phone_confirmation') {
      const responseText = await handlePhoneConfirmation({
        supabase,
        session,
        bodyText,
      })

      return twiml(responseText)
    }

    const sessionPairs: Array<{ user_id: string; client_id: string }> =
      Array.isArray(session.metadata?.client_pairs) && session.metadata.client_pairs.length
        ? session.metadata.client_pairs
        : session.user_id && session.client_id
          ? [{ user_id: session.user_id, client_id: session.client_id }]
          : []

    if (wantsPaidConfirmation(bodyText) && sessionPairs.length) {
      const responseText = await handlePaidConfirmation({
        supabase,
        clientPairs: sessionPairs,
      })

      return twiml(responseText)
    }

    if (session.state === 'confirmed' || session.state === 'done') {
      const responseText = await buildChargesMenu({
        supabase,
        session,
      })

      return twiml(responseText)
    }

    if (session.state === 'selecting_charge') {
      const responseText = await handleChargeSelection({
        supabase,
        session,
        bodyText,
      })

      return twiml(responseText)
    }

    const fallbackText = `Não entendi sua mensagem.

Responda MENU para consultar suas cobranças em aberto.`

    return twiml(fallbackText)
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro inesperado no robô.'

    console.error('Erro no robô inbound WhatsApp:', error)

    if (supabase) {
      await logPlatformEvent({
        supabase,
        eventType: 'inbound_whatsapp_error',
        status: 'error',
        message: 'Erro ao processar mensagem recebida no WhatsApp.',
        requestPayload,
        errorMessage,
      })
    }

    return twiml(
      'Tivemos uma instabilidade ao consultar suas cobranças. Tente novamente em alguns instantes.',
    )
  }
})