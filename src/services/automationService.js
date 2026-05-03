import { supabase } from './supabaseClient'
import { calculateScheduledFor } from '../utils/scheduleDate'

function formatCurrencyBRL(amount) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(amount || 0))
}

function formatDateBR(dueDate) {
  if (!dueDate) return '-'
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString('pt-BR')
}

function isInstallmentCharge(charge) {
  return charge?.payment_type === 'installment'
}

function hasCreditCardEnabled(charge) {
  return charge?.credit_card_enabled === true
}

function getInstallmentText(charge) {
  if (!isInstallmentCharge(charge)) return ''

  const number = charge.installment_number || '-'
  const total = charge.installment_total || '-'

  return `Parcela ${number}/${total}`
}

function getCleanDescription(charge) {
  const description = charge?.description || 'cobrança'

  if (!isInstallmentCharge(charge)) {
    return description
  }

  return description
    .replace(/\s*-\s*Parcela\s+\d+\/\d+$/i, '')
    .trim()
}

function buildPaymentBlock(charge) {
  const pixQrCode = charge?.pix_qr_code || ''
  const paymentUrl = charge?.payment_url || ''
  const creditCardEnabled = hasCreditCardEnabled(charge)

  if (!pixQrCode && !paymentUrl) return ''

  if (creditCardEnabled) {
    return `

Para pagar, acesse o link seguro do Mercado Pago abaixo.

Você poderá escolher Pix ou cartão de crédito:

${paymentUrl || 'Link de pagamento indisponível no momento.'}

Após o pagamento, a baixa será identificada automaticamente.`
  }

  return `

Para pagar via Pix, use o código copia e cola abaixo:

${pixQrCode || 'Pix indisponível no momento.'}

${paymentUrl ? `Link de pagamento:
${paymentUrl}

` : ''}Após o pagamento, a baixa será identificada automaticamente.`
}

export function buildAutomationMessage({
  clientName,
  description,
  amount,
  dueDate,
  messageType,
  pixQrCode,
  paymentUrl,
  paymentType = 'single',
  installmentNumber = null,
  installmentTotal = null,
  originalAmount = null,
  paymentMethods = ['pix'],
  creditCardEnabled = false,
}) {
  const charge = {
    description,
    amount,
    due_date: dueDate,
    payment_type: paymentType,
    installment_number: installmentNumber,
    installment_total: installmentTotal,
    original_amount: originalAmount,
    payment_methods: paymentMethods,
    credit_card_enabled: creditCardEnabled,
    pix_qr_code: pixQrCode,
    payment_url: paymentUrl,
  }

  const value = formatCurrencyBRL(amount)
  const date = formatDateBR(dueDate)
  const cleanDescription = getCleanDescription(charge)
  const installmentText = getInstallmentText(charge)
  const paymentBlock = buildPaymentBlock(charge)

  if (isInstallmentCharge(charge)) {
    if (messageType === 'urgent') {
      return `Olá ${clientName}, tudo bem?

A ${installmentText} da sua dívida encontra-se pendente ou em atraso.

Descrição: ${cleanDescription}
Valor da parcela: ${value}
Vencimento: ${date}

Pedimos a regularização o quanto antes.${paymentBlock}`
    }

    if (messageType === 'professional') {
      return `Olá ${clientName}, tudo bem?

Identificamos uma parcela pendente referente à sua dívida.

${installmentText}
Descrição: ${cleanDescription}
Valor da parcela: ${value}
Vencimento: ${date}

Ficamos à disposição para qualquer dúvida.${paymentBlock}`
    }

    return `Olá ${clientName}, tudo bem?

Passando para lembrar que a ${installmentText} da sua dívida está em aberto.

Descrição: ${cleanDescription}
Valor da parcela: ${value}
Vencimento: ${date}

Se já pagou, pode desconsiderar esta mensagem.${paymentBlock}`
  }

  if (messageType === 'urgent') {
    return `Olá ${clientName}, tudo bem?

Identificamos que o pagamento referente a "${cleanDescription}", no valor de ${value}, com vencimento em ${date}, ainda está pendente.

Pedimos a regularização o quanto antes.${paymentBlock}`
  }

  if (messageType === 'professional') {
    return `Olá ${clientName}, tudo bem?

Passando para lembrar sobre a cobrança referente a "${cleanDescription}", no valor de ${value}, com vencimento em ${date}.

Ficamos à disposição para qualquer dúvida.${paymentBlock}`
  }

  return `Olá ${clientName}, tudo bem?

Só passando para lembrar do pagamento referente a "${cleanDescription}", no valor de ${value}, com vencimento em ${date}.

Qualquer dúvida, fico à disposição.${paymentBlock}`
}

export function buildDefaultRules(selectedRules) {
  const rules = []

  if (selectedRules.oneMonthBefore) {
    rules.push({
      trigger_type: 'before_due',
      offset_days: 30,
      message_type: 'friendly',
      is_active: true,
    })
  }

  if (selectedRules.fifteenDaysBefore) {
    rules.push({
      trigger_type: 'before_due',
      offset_days: 15,
      message_type: 'friendly',
      is_active: true,
    })
  }

  if (selectedRules.fiveDaysBefore) {
    rules.push({
      trigger_type: 'before_due',
      offset_days: 5,
      message_type: 'professional',
      is_active: true,
    })
  }

  if (selectedRules.onDueDate) {
    rules.push({
      trigger_type: 'on_due',
      offset_days: 0,
      message_type: 'professional',
      is_active: true,
    })
  }

  if (selectedRules.afterDueDays && Number(selectedRules.afterDueDays) > 0) {
    rules.push({
      trigger_type: 'after_due',
      offset_days: Number(selectedRules.afterDueDays),
      message_type: 'urgent',
      is_active: true,
    })
  }

  return rules
}

export function buildScheduledDate(dueDate, rule) {
  if (rule.trigger_type === 'before_due') {
    return calculateScheduledFor({
      dueDate,
      offsetDays: -Number(rule.offset_days || 0),
      sendImmediatelyIfToday: false,
    })
  }

  if (rule.trigger_type === 'after_due') {
    return calculateScheduledFor({
      dueDate,
      offsetDays: Number(rule.offset_days || 0),
      sendImmediatelyIfToday: false,
    })
  }

  return calculateScheduledFor({
    dueDate,
    offsetDays: 0,
    sendImmediatelyIfToday: true,
  })
}

async function getClientById(clientId, userId) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, phone')
    .eq('id', clientId)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}

export async function replaceAutomationForCharge({ user_id, charge, rules }) {
  const clientId = charge.client_id || charge.client?.id

  if (!clientId) {
    throw new Error('Cliente não encontrado para gerar automação.')
  }

  const client = charge.client || (await getClientById(clientId, user_id))

  const { error: deleteRulesError } = await supabase
    .from('automation_rules')
    .delete()
    .eq('charge_id', charge.id)
    .eq('user_id', user_id)

  if (deleteRulesError) throw deleteRulesError

  const { error: deleteMessagesError } = await supabase
    .from('scheduled_messages')
    .delete()
    .eq('charge_id', charge.id)
    .eq('user_id', user_id)
    .eq('status', 'pending')

  if (deleteMessagesError) throw deleteMessagesError

  if (!rules.length) return

  const automationRows = rules.map((rule) => ({
    user_id,
    charge_id: charge.id,
    trigger_type: rule.trigger_type,
    offset_days: rule.offset_days,
    message_type: rule.message_type,
    is_active: rule.is_active,
  }))

  const { data: createdRules, error: createRulesError } = await supabase
    .from('automation_rules')
    .insert(automationRows)
    .select('*')

  if (createRulesError) throw createRulesError

  const scheduledRows = createdRules.map((rule) => ({
    user_id,
    charge_id: charge.id,
    client_id: client.id,
    automation_rule_id: rule.id,
    scheduled_for: buildScheduledDate(charge.due_date, rule),
    message_type: rule.message_type,
    message_text: buildAutomationMessage({
      clientName: client.name,
      description: charge.description,
      amount: charge.amount,
      dueDate: charge.due_date,
      messageType: rule.message_type,
      pixQrCode: charge.pix_qr_code,
      paymentUrl: charge.payment_url,

      paymentType: charge.payment_type || 'single',
      installmentNumber: charge.installment_number || null,
      installmentTotal: charge.installment_total || null,
      originalAmount: charge.original_amount || null,
      paymentMethods: charge.payment_methods || ['pix'],
      creditCardEnabled: charge.credit_card_enabled === true,
    }),
    phone: client.phone,
    status: 'pending',
  }))

  const { error: createMessagesError } = await supabase
    .from('scheduled_messages')
    .insert(scheduledRows)

  if (createMessagesError) throw createMessagesError
}

export async function getScheduledMessages(userId) {
  const { data, error } = await supabase
    .from('scheduled_messages')
    .select(`
      *,
      charge:charges (
        id,
        description,
        due_date,
        amount,
        payment_type,
        installment_number,
        installment_total,
        original_amount,
        payment_methods,
        credit_card_enabled,
        pix_qr_code,
        payment_url
      ),
      client:clients (
        id,
        name,
        phone
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function cancelPendingMessagesForCharge(chargeId, userId) {
  const { error } = await supabase
    .from('scheduled_messages')
    .update({
      status: 'cancelled',
      error_message: 'Cobrança marcada como paga.',
    })
    .eq('charge_id', chargeId)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (error) throw error
}

export async function retryScheduledMessage(messageId, userId) {
  const { error } = await supabase
    .from('scheduled_messages')
    .update({
      status: 'pending',
      error_message: null,
      provider_message_id: null,
      sent_at: null,
      scheduled_for: new Date(Date.now() - 60 * 1000).toISOString(),
    })
    .eq('id', messageId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function runScheduledWhatsAppSender() {
  const { data, error } = await supabase.functions.invoke(
    'send-scheduled-whatsapp',
    {
      body: {},
    },
  )

  if (error) throw error
  return data
}