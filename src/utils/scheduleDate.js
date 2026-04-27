const APP_TIMEZONE_OFFSET_HOURS = -3

export function getTodayDateKey() {
  const now = new Date()

  const brazilNow = new Date(
    now.getTime() + APP_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000,
  )

  return brazilNow.toISOString().slice(0, 10)
}

export function isSameDate(dateA, dateB) {
  return String(dateA).slice(0, 10) === String(dateB).slice(0, 10)
}

export function localDateToUtcIso(dateString, hour = 9, minute = 0) {
  const [year, month, day] = dateString.split('-').map(Number)

  const utcDate = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      hour - APP_TIMEZONE_OFFSET_HOURS,
      minute,
      0,
    ),
  )

  return utcDate.toISOString()
}

export function getImmediateScheduleIso() {
  return new Date().toISOString()
}

export function calculateScheduledFor({
  dueDate,
  offsetDays = 0,
  sendImmediatelyIfToday = false,
}) {
  const today = getTodayDateKey()

  if (sendImmediatelyIfToday && isSameDate(dueDate, today)) {
    return getImmediateScheduleIso()
  }

  const baseDate = new Date(`${dueDate}T00:00:00`)
  baseDate.setDate(baseDate.getDate() + Number(offsetDays))

  const targetDate = baseDate.toISOString().slice(0, 10)

  return localDateToUtcIso(targetDate, 9, 0)
}