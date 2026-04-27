import { supabase } from './supabaseClient'
import { calculateScheduledFor } from '../utils/scheduleDate'

function buildPixBlock({ pixQrCode, paymentUrl }) {
  if (!pixQrCode) return ''

  return `

Para pagar via Pix, use o código copia e cola abaixo:

${pixQrCode}

${paymentUrl ? `Link de pagamento:
${paymentUrl}` : ''}

Após o pagamento, a baixa será identificada automaticamente.`
}

export function buildAutomationMessage({
  clientName,
  description,
  amount,
  dueDate,
  messageType,
  pixQrCode,
  paymentUrl,
}) {
  const value = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(amount || 0))

  const date = new Date(`${dueDate}T00:00:00`).toLocaleDateString('pt-BR')
  const pixBlock = buildPixBlock({ pixQrCode, paymentUrl })

  if (messageType === 'urgent') {
    return `Olá ${clientName}, tudo bem? Identificamos que o pagamento referente a "${description}", no valor de ${value}, com vencimento em ${date}, ainda está pendente. Poderia verificar, por gentileza?${pixBlock}`
  }

  if (messageType === 'professional') {
    return `Olá ${clientName}, tudo bem? Passando para lembrar sobre o pagamento referente a "${description}", no valor de ${value}, com vencimento em ${date}. Ficamos à disposição.${pixBlock}`
  }

  return `Olá ${clientName}, tudo bem? Só passando para lembrar do pagamento referente a "${description}", no valor de ${value}, com vencimento em ${date}. Qualquer dúvida, fico à disposição.${pixBlock}`
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
        amount
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