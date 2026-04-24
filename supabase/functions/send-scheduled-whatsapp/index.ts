import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`)
  return value
}

function formatBrazilWhatsApp(phone: string) {
  const digits = onlyDigits(phone)

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    )

    const { data: messages, error } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(10)

    if (error) throw error

    const results = []

    for (const message of messages || []) {
      try {
        if (!message.phone) throw new Error('Telefone não informado.')
        if (!message.message_text) throw new Error('Mensagem não informada.')

        const sent = await sendWithTwilio({
          to: formatBrazilWhatsApp(message.phone),
          text: message.message_text,
        })

        await supabase
          .from('scheduled_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: sent.sid || null,
            attempts: Number(message.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', message.id)

        results.push({
          id: message.id,
          status: 'sent',
          provider: 'twilio',
          sid: sent.sid,
        })
      } catch (err) {
        await supabase
          .from('scheduled_messages')
          .update({
            status: 'failed',
            attempts: Number(message.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString(),
            error_message: err.message,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})