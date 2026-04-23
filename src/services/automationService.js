import { supabase } from './supabaseClient'

function toMiddayIso(dateString) {
  return `${dateString}T12:00:00`
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString()
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
    return addDays(dueDate, -rule.offset_days)
  }

  if (rule.trigger_type === 'after_due') {
    return addDays(dueDate, rule.offset_days)
  }

  return toMiddayIso(dueDate)
}

export async function replaceAutomationForCharge({
  user_id,
  charge,
  rules,
}) {
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
    client_id: charge.client_id || charge.client?.id,
    automation_rule_id: rule.id,
    scheduled_for: buildScheduledDate(charge.due_date, rule),
    message_type: rule.message_type,
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
    .order('scheduled_for', { ascending: true })

  if (error) throw error
  return data
}