import { formatCurrency, formatDate } from './format'

function getClientName(chargeOrName) {
  if (typeof chargeOrName === 'string') return chargeOrName
  return chargeOrName?.client?.name || 'cliente'
}

function getChargeDescription(charge) {
  const description = charge?.description || 'cobrança'

  if (charge?.payment_type !== 'installment') {
    return description
  }

  return description
    .replace(/\s*-\s*Parcela\s+\d+\/\d+$/i, '')
    .trim()
}

function getChargeAmount(charge) {
  return formatCurrency(Number(charge?.amount || 0))
}

function getChargeDueDate(charge) {
  return charge?.due_date ? formatDate(charge.due_date) : '-'
}

function isInstallmentCharge(charge) {
  return charge?.payment_type === 'installment'
}

function getInstallmentText(charge) {
  if (!isInstallmentCharge(charge)) return ''

  const number = charge.installment_number || '-'
  const total = charge.installment_total || '-'

  return `Parcela ${number}/${total}`
}

export function buildMessage(type, clientName, description, amount, dueDate) {
  const value = formatCurrency(amount)
  const date = formatDate(dueDate)

  if (type === 'friendly') {
    return `Oi ${clientName}, tudo bem? 😊

Passando para lembrar do pagamento de ${description}, no valor de ${value}, com vencimento em ${date}.

Se já pagou, pode desconsiderar esta mensagem 🙏`
  }

  if (type === 'professional') {
    return `Olá ${clientName},

Identificamos um pagamento pendente referente a ${description}, no valor de ${value}, com vencimento em ${date}.

Ficamos à disposição para qualquer dúvida.`
  }

  if (type === 'urgent') {
    return `Olá ${clientName}.

O pagamento de ${description}, no valor de ${value}, com vencimento em ${date}, encontra-se em atraso.

Pedimos a regularização o quanto antes.`
  }

  return `Olá ${clientName}.

Passando para lembrar do pagamento de ${description}, no valor de ${value}, com vencimento em ${date}.`
}

export function buildChargeMessage(charge) {
  const clientName = getClientName(charge)
  const description = getChargeDescription(charge)
  const amount = getChargeAmount(charge)
  const dueDate = getChargeDueDate(charge)
  const installmentText = getInstallmentText(charge)
  const type = charge?.message_type || 'friendly'

  if (isInstallmentCharge(charge)) {
    if (type === 'friendly') {
      return `Oi ${clientName}, tudo bem? 😊

Passando para lembrar que a ${installmentText} da sua dívida está em aberto.

Descrição: ${description}
Valor da parcela: ${amount}
Vencimento: ${dueDate}

Se já pagou, pode desconsiderar esta mensagem 🙏`
    }

    if (type === 'professional') {
      return `Olá ${clientName},

Identificamos uma parcela pendente referente à sua dívida.

${installmentText}
Descrição: ${description}
Valor da parcela: ${amount}
Vencimento: ${dueDate}

Ficamos à disposição para qualquer dúvida.`
    }

    if (type === 'urgent') {
      return `Olá ${clientName}.

A ${installmentText} da sua dívida encontra-se pendente ou em atraso.

Descrição: ${description}
Valor da parcela: ${amount}
Vencimento: ${dueDate}

Pedimos a regularização o quanto antes.`
    }
  }

  return buildMessage(
    type,
    clientName,
    description,
    Number(charge?.amount || 0),
    charge?.due_date,
  )
}

export function buildPixMessage(charge) {
  const clientName = getClientName(charge)
  const description = getChargeDescription(charge)
  const amount = getChargeAmount(charge)
  const dueDate = getChargeDueDate(charge)
  const pix = charge?.pix_qr_code || ''
  const paymentUrl = charge?.payment_url || ''
  const installmentText = getInstallmentText(charge)

  if (isInstallmentCharge(charge)) {
    return `Olá ${clientName}, tudo bem?

Esta é a ${installmentText} da sua dívida.

Descrição: ${description}
Valor da parcela: ${amount}
Vencimento: ${dueDate}

Para pagar via Pix, use o código copia e cola abaixo:

${pix}

${paymentUrl ? `Link de pagamento:\n${paymentUrl}\n\n` : ''}Após o pagamento, a baixa será identificada automaticamente.`
  }

  return `Olá ${clientName}, tudo bem?

Passando para lembrar sobre a cobrança referente a "${description}", no valor de ${amount}, com vencimento em ${dueDate}.

Para pagar via Pix, use o código copia e cola abaixo:

${pix}

${paymentUrl ? `Link de pagamento:\n${paymentUrl}\n\n` : ''}Após o pagamento, a baixa será identificada automaticamente.`
}

export function openWhatsApp(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '')

  if (!digits) {
    alert('Cliente sem telefone cadastrado.')
    return
  }

  const phoneWithCountryCode = digits.startsWith('55') ? digits : `55${digits}`
  const url = `https://wa.me/${phoneWithCountryCode}?text=${encodeURIComponent(message)}`

  window.open(url, '_blank')
}