import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys não configuradas.')
    }

    webpush.setVapidDetails(
      'mailto:contato@uselembrei.com.br',
      vapidPublicKey,
      vapidPrivateKey,
    )

    const { user_id, title, body, url } = await req.json()

    if (!user_id) return jsonResponse({ ok: false, error: 'user_id obrigatório.' }, 400)

    const supabase = createClient(supabaseUrl!, serviceRoleKey!)

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (!subscriptions?.length) {
      return jsonResponse({ ok: true, sent: 0, reason: 'Sem inscrições.' })
    }

    const payload = JSON.stringify({ title, body, url: url || '/app' })

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        ),
      ),
    )

    // Remove inscrições expiradas (410 Gone)
    const expiredEndpoints: string[] = []
    results.forEach((result, i) => {
      if (result.status === 'rejected' && (result.reason as any)?.statusCode === 410) {
        expiredEndpoints.push(subscriptions[i].endpoint)
      }
    })

    if (expiredEndpoints.length) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints)
    }

    const sent = results.filter((r) => r.status === 'fulfilled').length

    return jsonResponse({ ok: true, sent, total: subscriptions.length })
  } catch (error) {
    console.error('Erro send-push-notification:', error)
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'Erro inesperado.' },
      500,
    )
  }
})
