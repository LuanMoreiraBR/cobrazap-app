import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getEnv(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Variável ${name} não configurada.`)
  return value
}

function formatWhatsAppTo(phone: string | null | undefined) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `whatsapp:+${withCountry}`
}

function getTodayBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function getDaysBetween(from: Date, to: Date) {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

async function wasNotifiedToday(
  supabase: any,
  userId: string,
  daysRemaining: number,
): Promise<boolean> {
  const today = getTodayBR()
  const eventType = `subscription_expiry_notif_${daysRemaining}d`

  const { data } = await supabase
    .from('platform_event_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', `${today}T00:00:00`)
    .limit(1)
    .maybeSingle()

  return Boolean(data)
}

async function logNotification(
  supabase: any,
  userId: string,
  daysRemaining: number,
  status: 'success' | 'error',
  message: string,
) {
  await supabase.from('platform_event_logs').insert({
    provider: 'twilio',
    event_type: `subscription_expiry_notif_${daysRemaining}d`,
    user_id: userId,
    related_table: 'user_subscriptions',
    status,
    message,
  })
}

async function sendWhatsApp({
  to,
  body,
  accountSid,
  authToken,
  messagingServiceSid,
}: {
  to: string
  body: string
  accountSid: string
  authToken: string
  messagingServiceSid: string
}) {
  const params = new URLSearchParams()
  params.set('MessagingServiceSid', messagingServiceSid)
  params.set('To', to)
  params.set('Body', body)

  const auth = btoa(`${accountSid}:${authToken}`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`Twilio erro: ${data?.message || JSON.stringify(data)}`)
  }

  return data
}

function buildExpiryMessage(daysRemaining: number, planName: string): string {
  if (daysRemaining <= 1) {
    return (
      `⚠️ *Lembrei* — seu plano *${planName}* vence *hoje*!\n\n` +
      `Renove agora para não perder o acesso: https://www.uselembrei.com.br/app/plano`
    )
  }
  return (
    `⏳ *Lembrei* — seu plano *${planName}* vence em *${daysRemaining} dias*.\n\n` +
    `Renove com antecedência para manter o envio de cobranças sem interrupção: https://www.uselembrei.com.br/app/plano`
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)
  }

  try {
    const supabaseUrl = getEnv('SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    const accountSid = getEnv('TWILIO_ACCOUNT_SID')
    const authToken = getEnv('TWILIO_AUTH_TOKEN')
    const messagingServiceSid = getEnv('TWILIO_MESSAGING_SERVICE_SID')

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date()
    const in8Days = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)

    // Fetch all active paid subscriptions expiring within 8 days
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        current_period_end,
        plan:platform_plans (name, price),
        profile:profiles (phone)
      `)
      .eq('status', 'active')
      .not('current_period_end', 'is', null)
      .lte('current_period_end', in8Days.toISOString())
      .gt('current_period_end', now.toISOString())

    if (subError) throw subError

    const results = []

    for (const sub of subscriptions || []) {
      const planPrice = Number(sub.plan?.price ?? 0)
      if (planPrice <= 0) continue // skip free plans

      const phone = sub.profile?.phone
      const periodEnd = new Date(sub.current_period_end)
      const daysRemaining = getDaysBetween(now, periodEnd)

      if (![7, 3, 1].includes(daysRemaining)) continue

      const alreadyNotified = await wasNotifiedToday(supabase, sub.user_id, daysRemaining)
      if (alreadyNotified) {
        results.push({ user_id: sub.user_id, days: daysRemaining, status: 'skipped', reason: 'already_notified_today' })
        continue
      }

      if (!phone) {
        await logNotification(supabase, sub.user_id, daysRemaining, 'error', 'Usuário sem telefone cadastrado no perfil.')
        results.push({ user_id: sub.user_id, days: daysRemaining, status: 'skipped', reason: 'no_phone' })
        continue
      }

      const to = formatWhatsAppTo(phone)
      if (!to) {
        await logNotification(supabase, sub.user_id, daysRemaining, 'error', 'Telefone inválido no perfil.')
        results.push({ user_id: sub.user_id, days: daysRemaining, status: 'skipped', reason: 'invalid_phone' })
        continue
      }

      try {
        const messageBody = buildExpiryMessage(daysRemaining, sub.plan?.name || 'atual')
        await sendWhatsApp({ to, body: messageBody, accountSid, authToken, messagingServiceSid })
        await logNotification(supabase, sub.user_id, daysRemaining, 'success', `Notificação de vencimento em ${daysRemaining}d enviada para ${to}.`)
        results.push({ user_id: sub.user_id, days: daysRemaining, status: 'sent' })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        await logNotification(supabase, sub.user_id, daysRemaining, 'error', `Falha ao enviar notificação: ${errMsg}`)
        results.push({ user_id: sub.user_id, days: daysRemaining, status: 'error', reason: errMsg })
      }
    }

    return jsonResponse({ ok: true, processed: results.length, results })
  } catch (err) {
    console.error('notify-expiring-subscriptions error:', err)
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : 'Erro inesperado.' },
      500,
    )
  }
})
