import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function formatBrazilWhatsApp(phone: string) {
  const digits = onlyDigits(phone)

  if (!digits) {
    throw new Error('Telefone vazio.')
  }

  if (digits.startsWith('55')) {
    return `whatsapp:+${digits}`
  }

  return `whatsapp:+55${digits}`
}

async function sendWithTwilio({ to, text }: { to: string; text: string }) {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const from = getEnv('TWILIO_WHATSAPP_FROM')

  const body = new URLSearchParams()
  body.set('From', from)
  body.set('To', to)
  body.set('Body', text)

  const auth = btoa(`${accountSid}:${authToken}`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Erro Twilio: ${JSON.stringify(data)}`)
  }

  return data
}

Deno.serve(async () => {
  const supabase = createClient(
    getEnv('SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const { data: messages, error } = await supabase
    .from('scheduled_messages')
    .select(`
      *,
      charge:charges (
        id,
        status,
        payment_status
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(20)

  if (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const results = []

  for (const message of messages || []) {
    try {
      if (message.charge?.status === 'pago') {
        await supabase
          .from('scheduled_messages')
          .update({
            status: 'cancelled',
            error_message: 'Cobrança já paga.',
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', message.id)

        results.push({
          id: message.id,
          status: 'cancelled',
          reason: 'Cobrança já paga.',
        })

        continue
      }

      const to = formatBrazilWhatsApp(message.phone)
      const text = message.message_text

      if (!text) {
        throw new Error('Mensagem vazia.')
      }

      const twilioResult = await sendWithTwilio({
        to,
        text,
      })

      await supabase
        .from('scheduled_messages')
        .update({
          status: 'sent',
          provider_message_id: twilioResult.sid,
          error_message: null,
          sent_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
          attempts: Number(message.attempts || 0) + 1,
        })
        .eq('id', message.id)

      results.push({
        id: message.id,
        status: 'sent',
        to,
        provider_message_id: twilioResult.sid,
      })
    } catch (err) {
      await supabase
        .from('scheduled_messages')
        .update({
          status: 'failed',
          error_message: err.message,
          last_attempt_at: new Date().toISOString(),
          attempts: Number(message.attempts || 0) + 1,
        })
        .eq('id', message.id)

      results.push({
        id: message.id,
        status: 'failed',
        error: err.message,
      })
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      found: messages?.length || 0,
      results,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    },
  )
})