export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0)
}

export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)

  if (!digits) return ''

  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, ddd, part1, part2) => {
        let result = ''
        if (ddd) result += `(${ddd}`
        if (ddd.length === 2) result += ') '
        if (part1) result += part1
        if (part2) result += `-${part2}`
        return result
      })
      .trim()
  }

  return digits
    .replace(/^(\d{0,2})(\d{0,5})(\d{0,4}).*/, (_, ddd, part1, part2) => {
      let result = ''
      if (ddd) result += `(${ddd}`
      if (ddd.length === 2) result += ') '
      if (part1) result += part1
      if (part2) result += `-${part2}`
      return result
    })
    .trim()
}

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

export function formatDate(dateString) {
  if (!dateString) return ''
  const [year, month, day] = dateString.split('-')
  if (!year || !month || !day) return dateString
  return `${day}/${month}/${year}`
}