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

async function getAuthenticatedAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization') || ''
  const jwt = authHeader.replace('Bearer ', '')

  if (!jwt) {
    return {
      user: null,
      admin: null,
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
      admin: null,
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
      admin: null,
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

async function logPlatformEvent({
  supabase,
  provider = 'admin',
  eventType,
  userId = null,
  relatedTable = null,
  relatedId = null,
  status = 'info',
  message = '',
  requestPayload = {},
  responsePayload = {},
  errorMessage = null,
}: {
  supabase: any
  provider?: string
  eventType: string
  userId?: string | null
  relatedTable?: string | null
  relatedId?: string | null
  status?: string
  message?: string
  requestPayload?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  errorMessage?: string | null
}) {
  try {
    await supabase.from('platform_event_logs').insert({
      provider,
      event_type: eventType,
      user_id: userId,
      related_table: relatedTable,
      related_id: relatedId,
      status,
      message,
      request_payload: requestPayload,
      response_payload: responsePayload,
      error_message: errorMessage,
    })
  } catch (error) {
    console.error('Erro ao gravar platform_event_logs:', error)
  }
}

async function logAdminAction({
  supabase,
  adminUserId,
  targetUserId,
  action,
  payload,
}: {
  supabase: any
  adminUserId: string
  targetUserId: string | null
  action: string
  payload: Record<string, unknown>
}) {
  try {
    await supabase.from('platform_admin_actions').insert({
      admin_user_id: adminUserId,
      target_user_id: targetUserId,
      action,
      payload,
    })
  } catch (error) {
    console.error('Erro ao gravar platform_admin_actions:', error)
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

  let supabase: any = null
  let requestPayload: Record<string, unknown> = {}

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Variáveis do Supabase não configuradas.')
    }

    supabase = createClient(supabaseUrl, serviceRoleKey)

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

    requestPayload = body

    const messageId = String(body.message_id || '')
    const action = String(body.action || '')

    if (!messageId) {
      return jsonResponse(
        {
          ok: false,
          error: 'message_id é obrigatório.',
        },
        400,
      )
    }

    if (
      ![
        'RESET_PROCESSING_TO_PENDING',
        'REPROCESS_FAILED',
        'CANCEL_MESSAGE',
      ].includes(action)
    ) {
      return jsonResponse(
        {
          ok: false,
          error: 'Ação inválida.',
        },
        400,
      )
    }

    const { data: scheduledMessage, error: messageError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle()

    if (messageError) throw messageError

    if (!scheduledMessage) {
      return jsonResponse(
        {
          ok: false,
          error: 'Mensagem agendada não encontrada.',
        },
        404,
      )
    }

    let updatePayload: Record<string, unknown> = {}
    let successMessage = ''

    if (action === 'RESET_PROCESSING_TO_PENDING') {
      if (scheduledMessage.status !== 'processing') {
        return jsonResponse(
          {
            ok: false,
            error: 'Só é possível voltar para pending mensagens em processing.',
          },
          400,
        )
      }

      updatePayload = {
        status: 'pending',
        error_message:
          'Mensagem voltou para pending manualmente pela administração.',
        processing_started_at: null,
        last_attempt_at: new Date().toISOString(),
      }

      successMessage = 'Mensagem voltou para pending.'
    }

    if (action === 'REPROCESS_FAILED') {
      if (scheduledMessage.status !== 'failed') {
        return jsonResponse(
          {
            ok: false,
            error: 'Só é possível reprocessar mensagens com status failed.',
          },
          400,
        )
      }

      updatePayload = {
        status: 'pending',
        error_message: null,
        processing_started_at: null,
        last_attempt_at: null,
      }

      successMessage = 'Mensagem failed voltou para pending.'
    }

    if (action === 'CANCEL_MESSAGE') {
      if (!['failed', 'processing', 'pending'].includes(scheduledMessage.status)) {
        return jsonResponse(
          {
            ok: false,
            error:
              'Só é possível cancelar mensagens pending, processing ou failed.',
          },
          400,
        )
      }

      updatePayload = {
        status: 'cancelled',
        error_message: 'Mensagem cancelada manualmente pela administração.',
        processing_started_at: null,
        last_attempt_at: new Date().toISOString(),
      }

      successMessage = 'Mensagem cancelada.'
    }

    const { data: updatedMessage, error: updateError } = await supabase
      .from('scheduled_messages')
      .update(updatePayload)
      .eq('id', messageId)
      .select('*')
      .single()

    if (updateError) throw updateError

    await logAdminAction({
      supabase,
      adminUserId: auth.user.id,
      targetUserId: scheduledMessage.user_id || null,
      action,
      payload: {
        message_id: messageId,
        previous_status: scheduledMessage.status,
        new_status: updatePayload.status,
        charge_id: scheduledMessage.charge_id || null,
        client_id: scheduledMessage.client_id || null,
      },
    })

    await logPlatformEvent({
      supabase,
      provider: 'admin',
      eventType: 'scheduled_message_admin_action',
      userId: scheduledMessage.user_id || null,
      relatedTable: 'scheduled_messages',
      relatedId: messageId,
      status: 'success',
      message: successMessage,
      requestPayload: {
        ...requestPayload,
        admin_user_id: auth.user.id,
      },
      responsePayload: {
        previous_status: scheduledMessage.status,
        new_status: updatePayload.status,
      },
    })

    return jsonResponse({
      ok: true,
      message: successMessage,
      scheduled_message: updatedMessage,
    })
  } catch (error) {
    console.error(error)

    await logPlatformEvent({
      supabase,
      provider: 'admin',
      eventType: 'scheduled_message_admin_action_failed',
      status: 'error',
      message: 'Erro ao executar ação administrativa em mensagem agendada.',
      requestPayload,
      errorMessage: error instanceof Error ? error.message : 'Erro inesperado.',
    })

    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro inesperado.',
      },
      500,
    )
  }
})