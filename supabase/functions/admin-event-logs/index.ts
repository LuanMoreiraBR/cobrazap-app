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

function getDateFromRange(range: string) {
  const now = new Date()
  const date = new Date(now)

  if (range === '24h') {
    date.setHours(date.getHours() - 24)
    return date.toISOString()
  }

  if (range === '7d') {
    date.setDate(date.getDate() - 7)
    return date.toISOString()
  }

  if (range === '30d') {
    date.setDate(date.getDate() - 30)
    return date.toISOString()
  }

  date.setDate(date.getDate() - 7)
  return date.toISOString()
}

async function getAuthenticatedAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  if (!jwt) {
    return {
      user: null,
      error: 'Usuário não autenticado.',
      status: 401,
    }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt)

  if (userError || !user) {
    return {
      user: null,
      error: 'Sessão inválida.',
      status: 401,
    }
  }

  const { data: admin, error: adminError } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) throw adminError

  if (!admin) {
    return {
      user: null,
      error: 'Acesso negado. Usuário não é admin da plataforma.',
      status: 403,
    }
  }

  return {
    user,
    admin,
    error: null,
    status: 200,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        error: 'Método não permitido.',
      },
      405,
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const auth = await getAuthenticatedAdmin(req, supabase)

    if (auth.error) {
      return jsonResponse(
        {
          ok: false,
          error: auth.error,
        },
        auth.status,
      )
    }

    const body = await req.json().catch(() => ({}))

    const provider = String(body.provider || 'all')
    const status = String(body.status || 'all')
    const range = String(body.range || '7d')
    const search = String(body.search || '').trim()
    const limit = Math.min(Number(body.limit || 100), 300)

    const fromDate = getDateFromRange(range)

    let query = supabase
      .from('platform_event_logs')
      .select(`
        id,
        provider,
        event_type,
        user_id,
        related_table,
        related_id,
        status,
        message,
        error_message,
        request_payload,
        response_payload,
        created_at
      `)
      .gte('created_at', fromDate)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (provider !== 'all') {
      query = query.eq('provider', provider)
    }

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(
        `message.ilike.%${search}%,error_message.ilike.%${search}%,event_type.ilike.%${search}%`,
      )
    }

    const { data: logs, error: logsError } = await query

    if (logsError) throw logsError

    const userIds = Array.from(
      new Set((logs || []).map((item: any) => item.user_id).filter(Boolean)),
    )

    let profilesByUserId: Record<string, any> = {}

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('app_user_profiles')
        .select('user_id, name, email')
        .in('user_id', userIds)

      if (profilesError) throw profilesError

      profilesByUserId = Object.fromEntries(
        (profiles || []).map((profile: any) => [profile.user_id, profile]),
      )
    }

    const enrichedLogs = (logs || []).map((log: any) => {
      const profile = profilesByUserId[log.user_id] || null

      return {
        ...log,
        user_name: profile?.name || null,
        user_email: profile?.email || null,
      }
    })

    const summary = {
      total: enrichedLogs.length,
      success: enrichedLogs.filter((item: any) => item.status === 'success').length,
      error: enrichedLogs.filter((item: any) => item.status === 'error').length,
      ignored: enrichedLogs.filter((item: any) => item.status === 'ignored').length,
      info: enrichedLogs.filter((item: any) => item.status === 'info').length,
      twilio: enrichedLogs.filter((item: any) => item.provider === 'twilio').length,
      mercado_pago: enrichedLogs.filter(
        (item: any) => item.provider === 'mercado_pago',
      ).length,
    }

    return jsonResponse({
      ok: true,
      filters: {
        provider,
        status,
        range,
        search,
        limit,
        from_date: fromDate,
      },
      summary,
      logs: enrichedLogs,
    })
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado.',
      },
      500,
    )
  }
})