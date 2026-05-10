export function addMonthsKeepingDueDay(baseDateString, monthsToAdd) {
  const [year, month, day] = String(baseDateString).split('-').map(Number)

  const targetMonthIndex = month - 1 + monthsToAdd
  const targetYear = year + Math.floor(targetMonthIndex / 12)
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12

  const lastDayOfTargetMonth = new Date(
    targetYear,
    normalizedMonthIndex + 1,
    0,
  ).getDate()

  const safeDay = Math.min(day, lastDayOfTargetMonth)
  const result = new Date(targetYear, normalizedMonthIndex, safeDay)

  const yyyy = result.getFullYear()
  const mm = String(result.getMonth() + 1).padStart(2, '0')
  const dd = String(result.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

export function buildRecurringChargePayloads({
  basePayload,
  recurrenceMonths,
}) {
  const total = Math.max(1, Number(recurrenceMonths || 1))
  const recurrenceGroupId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`

  const dueDay = Number(String(basePayload.due_date || '').split('-')[2] || 0)

  return Array.from({ length: total }, (_, index) => {
    const dueDate = addMonthsKeepingDueDay(basePayload.due_date, index)
    const suffix = total > 1 ? ` - Recorrência ${index + 1}/${total}` : ''

    return {
      ...basePayload,
      due_date: dueDate,
      description: `${basePayload.description}${suffix}`,
      recurrence_group_id: recurrenceGroupId,
      recurrence_type: total > 1 ? 'monthly' : 'single',
      recurrence_frequency: total > 1 ? 'monthly' : null,
      recurrence_total: total,
      recurrence_number: index + 1,
      recurrence_day: dueDay || null,
    }
  })
}