import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Método não permitido.' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')

    if (!jwt) {
      return jsonResponse({ ok: false, error: 'Não autenticado.' }, 401)
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const { data: freePlan, error: planError } = await supabase
      .from('platform_plans')
      .select('*')
      .eq('id', 'free')
      .eq('is_active', true)
      .single()

    if (planError || !freePlan) {
      return jsonResponse({ ok: false, error: 'Plano gratuito não encontrado.' }, 404)
    }

    // Block if user already has an active paid subscription
    const { data: existing } = await supabase
      .from('user_subscriptions')
      .select('*, plan:platform_plans(*)')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing?.status === 'active' && Number(existing?.plan?.price || 0) > 0) {
      return jsonResponse(
        { ok: false, error: 'Você já possui um plano pago ativo.' },
        400,
      )
    }

    // Upsert free subscription
    const now = new Date().toISOString()

    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .upsert(
        {
          user_id: user.id,
          plan_id: 'free',
          status: 'active',
          current_period_start: now,
          current_period_end: null,
          activated_at: now,
          updated_at: now,
          mercado_pago_payment_id: null,
          mercado_pago_preference_id: null,
          payment_url: null,
          payment_method: null,
          selected_installments: null,
          last_payment_status: null,
          cancelled_at: null,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single()

    if (subError) throw subError

    return jsonResponse({ ok: true, subscription })
  } catch (err) {
    console.error('activate-free-plan error:', err)
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : 'Erro inesperado.' },
      500,
    )
  }
})
