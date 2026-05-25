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
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

const ALLOWED_FIELDS = [
  'name',
  'price',
  'max_clients',
  'max_messages_per_month',
  'extra_message_price',
  'description',
  'is_active',
]

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

    // Verify the caller is a platform admin
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')

    if (!jwt) {
      return jsonResponse({ ok: false, error: 'Não autenticado.' }, 401)
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)

    if (userError || !user) {
      return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const { data: adminRow, error: adminError } = await supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (adminError) throw adminError

    if (!adminRow) {
      return jsonResponse({ ok: false, error: 'Acesso negado.' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const { plan_id, fields } = body

    if (!plan_id) {
      return jsonResponse({ ok: false, error: 'plan_id é obrigatório.' }, 400)
    }

    if (!fields || typeof fields !== 'object') {
      return jsonResponse({ ok: false, error: 'fields é obrigatório.' }, 400)
    }

    // Only allow safe fields to be updated
    const sanitized: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in fields) {
        sanitized[key] = fields[key]
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return jsonResponse({ ok: false, error: 'Nenhum campo válido para atualizar.' }, 400)
    }

    const { data: updatedPlan, error: updateError } = await supabase
      .from('platform_plans')
      .update(sanitized)
      .eq('id', plan_id)
      .select('*')
      .single()

    if (updateError) throw updateError

    return jsonResponse({ ok: true, plan: updatedPlan })
  } catch (err) {
    console.error('admin-update-plan error:', err)
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Erro inesperado.',
      },
      500,
    )
  }
})
