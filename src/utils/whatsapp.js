import { formatCurrency, formatDate } from './format'

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

export function openWhatsApp(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '')
  const url = `https://wa.me/55${digits}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}
export function buildPixMessage(charge) {
  const clientName = charge.client?.name || 'cliente'
  const description = charge.description || 'cobrança'

  const amount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(charge.amount || 0))

  const dueDate = charge.due_date
    ? new Date(`${charge.due_date}T00:00:00`).toLocaleDateString('pt-BR')
    : '-'

  const pix = charge.pix_qr_code || ''
  const paymentUrl = charge.payment_url || ''

  return `Olá ${clientName}, tudo bem?

Passando para lembrar sobre a cobrança referente a "${description}", no valor de ${amount}, com vencimento em ${dueDate}.

Para pagar via Pix, use o código copia e cola abaixo:

${pix}

Link de pagamento:
${paymentUrl}

Após o pagamento, a baixa será identificada automaticamente.`
}