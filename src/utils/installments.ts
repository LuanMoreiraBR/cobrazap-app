export function addMonthsKeepingDueDay(dateString: string, monthsToAdd: number) {
  const originalDate = new Date(dateString + 'T00:00:00')
  const originalDay = originalDate.getDate()

  const targetYear = originalDate.getFullYear()
  const targetMonth = originalDate.getMonth() + monthsToAdd

  const lastDayOfTargetMonth = new Date(
    targetYear,
    targetMonth + 1,
    0
  ).getDate()

  const finalDay = Math.min(originalDay, lastDayOfTargetMonth)

  const finalDate = new Date(targetYear, targetMonth, finalDay)

  const year = finalDate.getFullYear()
  const month = String(finalDate.getMonth() + 1).padStart(2, '0')
  const day = String(finalDate.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function generateInstallments({
  amount,
  dueDate,
  installments,
}: {
  amount: number
  dueDate: string
  installments: number
}) {
  const installmentAmount = Math.floor((amount / installments) * 100) / 100
  const totalCalculated = installmentAmount * installments
  const difference = Number((amount - totalCalculated).toFixed(2))

  return Array.from({ length: installments }, (_, index) => {
    const isLast = index === installments - 1

    return {
      installment_number: index + 1,
      installment_total: installments,
      amount: isLast
        ? Number((installmentAmount + difference).toFixed(2))
        : installmentAmount,
      due_date: addMonthsKeepingDueDay(dueDate, index),
    }
  })
}