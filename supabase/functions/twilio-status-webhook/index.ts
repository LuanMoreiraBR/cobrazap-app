import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Twilio sends delivery status callbacks as form-urlencoded POST:
// MessageSid, MessageStatus (queued|sent|delivered|read|failed|undelivered), To, From, ErrorCode

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TERMINAL_FAILURE_STATUSES = ['failed', 'undelivered']
const POSITIVE_STATUSES = ['delivered', 'read']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('', { status: 204, headers: corsHeaders })
    }

    const contentType = req.headers.get('content-type') || ''
    let messageSid = ''
    let messageStatus = ''
    let errorCode = ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      messageSid = String(form.get('MessageSid') || '')
      messageStatus = String(form.get('MessageStatus') || '').toLowerCase()
      errorCode = String(form.get('ErrorCode') || '')
    } else {
      const payload = await req.json().catch(() => ({}))
      messageSid = String(payload.MessageSid || payload.messageSid || '')
      messageStatus = String(payload.MessageStatus || payload.messageStatus || '').toLowerCase()
      errorCode = String(payload.ErrorCode || payload.errorCode || '')
    }

    if (!messageSid || !messageStatus) {
      return new Response('', { status: 204, headers: corsHeaders })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Find the scheduled message by Twilio MessageSid
    const { data: message } = await supabase
      .from('scheduled_messages')
      .select('id, user_id, charge_id, status')
      .eq('provider_message_id', messageSid)
      .maybeSingle()

    if (message) {
      const isFailure = TERMINAL_FAILURE_STATUSES.includes(messageStatus)

      // Update delivery status on the message
      const updatePayload: Record<string, unknown> = {
        delivery_status: messageStatus,
      }

      if (isFailure && message.status === 'sent') {
        updatePayload.status = 'failed'
        updatePayload.error_message = errorCode
          ? `Falha na entrega (código Twilio: ${errorCode})`
          : 'Falha na entrega pelo operador de telefonia.'
      }

      await supabase
        .from('scheduled_messages')
        .update(updatePayload)
        .eq('id', message.id)

      // Log the delivery event
      const logStatus = isFailure ? 'error' : POSITIVE_STATUSES.includes(messageStatus) ? 'success' : 'info'
      const logMsg = isFailure
        ? `Falha na entrega da mensagem WhatsApp. Status: ${messageStatus}. ErrorCode: ${errorCode || 'N/A'}.`
        : `Status de entrega atualizado: ${messageStatus}.`

      await supabase.from('platform_event_logs').insert({
        provider: 'twilio',
        event_type: 'whatsapp_delivery_status',
        user_id: message.user_id,
        related_table: 'scheduled_messages',
        related_id: message.id,
        status: logStatus,
        message: logMsg,
        request_payload: { message_sid: messageSid, message_status: messageStatus, error_code: errorCode },
      })
    } else {
      // Message not found — log for debugging without failing
      console.log('twilio-status-webhook: MessageSid não encontrado:', messageSid, messageStatus)
    }

    // Twilio expects a 2xx response — return empty 204
    return new Response('', { status: 204, headers: corsHeaders })
  } catch (err) {
    console.error('twilio-status-webhook error:', err)
    // Always return 2xx to Twilio to prevent unnecessary retries
    return new Response('', { status: 204, headers: corsHeaders })
  }
})
