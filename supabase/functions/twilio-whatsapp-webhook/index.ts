const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function xmlResponse(message: string, status = 200) {
  const safeMessage = String(message || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safeMessage}</Message>
</Response>`,
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    },
  )
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

function normalizeText(value: string | null) {
  return String(value || '').trim().toLowerCase()
}

function buildBotReply(incomingText: string) {
  const text = normalizeText(incomingText)

  if (!text) {
    return 'Olá! Sou o assistente da Lembrei. Como posso te ajudar?'
  }

  if (text.includes('oi') || text.includes('olá') || text.includes('ola')) {
    return 'Olá! Sou o assistente da Lembrei. Recebi sua mensagem. 😊'
  }

  if (text.includes('pix')) {
    return 'Você pode consultar o link de pagamento enviado anteriormente. Se precisar, solicite uma segunda via ao responsável pela cobrança.'
  }

  if (text.includes('paguei') || text.includes('pago')) {
    return 'Obrigado por avisar! A baixa será identificada automaticamente assim que o pagamento for confirmado.'
  }

  if (text.includes('atendente') || text.includes('humano')) {
    return 'Certo. Vou registrar sua solicitação para atendimento humano.'
  }

  return `Recebi sua mensagem: "${incomingText}". Em breve a Lembrei dará continuidade ao atendimento.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        error: 'Método não permitido. Use POST.',
      },
      405,
    )
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    let from = ''
    let to = ''
    let body = ''
    let messageSid = ''

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      from = String(form.get('From') || '')
      to = String(form.get('To') || '')
      body = String(form.get('Body') || '')
      messageSid = String(form.get('MessageSid') || '')
    } else {
      const payload = await req.json().catch(() => ({}))
      from = String(payload.From || payload.from || '')
      to = String(payload.To || payload.to || '')
      body = String(payload.Body || payload.body || '')
      messageSid = String(payload.MessageSid || payload.messageSid || '')
    }

    console.log('Mensagem WhatsApp recebida:', {
      from,
      to,
      body,
      messageSid,
    })

    const reply = buildBotReply(body)

    return xmlResponse(reply)
  } catch (error) {
    console.error('Erro no webhook WhatsApp:', error)

    return xmlResponse(
      'Olá! Recebi sua mensagem, mas tive um problema temporário ao processar. Tente novamente em alguns instantes.',
      200,
    )
  }
})