import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(base64 + padding)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function importVapidPrivateKey(
  privateKeyBase64url: string,
  publicKeyBase64url: string,
): Promise<CryptoKey> {
  const pubBytes = base64UrlToUint8Array(publicKeyBase64url)
  // pubBytes = [0x04, x(32), y(32)]
  const x = uint8ArrayToBase64Url(pubBytes.slice(1, 33))
  const y = uint8ArrayToBase64Url(pubBytes.slice(33, 65))

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: privateKeyBase64url,
  }

  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
    'sign',
  ])
}

async function createVapidJWT(
  endpoint: string,
  subject: string,
  privateKey: CryptoKey,
): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`

  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: subject,
  }

  const enc = new TextEncoder()
  const headerB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(header)))
  const claimsB64 = uint8ArrayToBase64Url(enc.encode(JSON.stringify(claims)))
  const signingInput = `${headerB64}.${claimsB64}`

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    enc.encode(signingInput),
  )

  return `${signingInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`
}

async function encrypt(
  payload: string,
  p256dhBase64url: string,
  authBase64url: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc = new TextEncoder()
  const payloadBytes = enc.encode(payload)

  // Import receiver's public key
  const receiverPublicKeyBytes = base64UrlToUint8Array(p256dhBase64url)
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw',
    receiverPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  // Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  )

  // Export ephemeral public key
  const ephemeralPublicKeyRaw = await crypto.subtle.exportKey(
    'raw',
    ephemeralKeyPair.publicKey,
  )
  const serverPublicKey = new Uint8Array(ephemeralPublicKeyRaw)

  // Derive shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverPublicKey },
    ephemeralKeyPair.privateKey,
    256,
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const authBytes = base64UrlToUint8Array(authBase64url)

  // HKDF for PRK_key
  const ikm = new Uint8Array(sharedSecretBits)

  const authInfo = enc.encode('Content-Encoding: auth\0')
  const prkKeyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey', 'deriveBits'])
  const prkKey = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authBytes, info: authInfo },
    prkKeyMaterial,
    256,
  )

  // HKDF for content encryption key and nonce
  const prkMaterial = await crypto.subtle.importKey('raw', prkKey, 'HKDF', false, ['deriveBits'])

  const keyInfo = buildInfo('aesgcm', receiverPublicKeyBytes, serverPublicKey)
  const nonceInfo = buildInfo('nonce', receiverPublicKeyBytes, serverPublicKey)

  const contentKey = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: keyInfo },
    prkMaterial,
    128,
  )

  const prkMaterial2 = await crypto.subtle.importKey('raw', prkKey, 'HKDF', false, ['deriveBits'])
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkMaterial2,
    96,
  )

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])

  // Pad payload
  const padded = new Uint8Array(2 + payloadBytes.length)
  padded.set(payloadBytes, 2)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBits },
    aesKey,
    padded,
  )

  return { ciphertext: new Uint8Array(ciphertext), salt, serverPublicKey }
}

function buildInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const enc = new TextEncoder()
  const typeBytes = enc.encode(`Content-Encoding: ${type}\0P-256\0`)
  const result = new Uint8Array(typeBytes.length + 2 + clientPublicKey.length + 2 + serverPublicKey.length)
  let offset = 0
  result.set(typeBytes, offset); offset += typeBytes.length
  new DataView(result.buffer).setUint16(offset, clientPublicKey.length, false); offset += 2
  result.set(clientPublicKey, offset); offset += clientPublicKey.length
  new DataView(result.buffer).setUint16(offset, serverPublicKey.length, false); offset += 2
  result.set(serverPublicKey, offset)
  return result
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKeyBase64url: string,
  subject: string,
): Promise<{ status: number; body: string }> {
  const privateKey = await importVapidPrivateKey(vapidPrivateKeyBase64url, vapidPublicKey)
  const jwt = await createVapidJWT(subscription.endpoint, subject, privateKey)

  const { ciphertext, salt, serverPublicKey } = await encrypt(
    payload,
    subscription.p256dh,
    subscription.auth,
  )

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'Encryption': `salt=${uint8ArrayToBase64Url(salt)}`,
      'Crypto-Key': `dh=${uint8ArrayToBase64Url(serverPublicKey)};p256ecdsa=${vapidPublicKey}`,
      'Authorization': `WebPush ${jwt}`,
      'TTL': '86400',
    },
    body: ciphertext,
  })

  const body = await response.text()
  return { status: response.status, body }
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

    const { user_id, title, body, url } = await req.json()

    if (!user_id) return jsonResponse({ ok: false, error: 'user_id obrigatório.' }, 400)

    const supabase = createClient(supabaseUrl!, serviceRoleKey!)

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (!subscriptions?.length) {
      return jsonResponse({ ok: true, sent: 0, no_subscriptions: true })
    }

    const payload = JSON.stringify({ title, body, url: url || '/app' })
    const subject = 'mailto:contato@uselembrei.com.br'

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, subject),
      ),
    )

    const expiredEndpoints: string[] = []
    const errors: string[] = []
    let sent = 0

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        if (result.value.status === 201 || result.value.status === 200) {
          sent++
        } else if (result.value.status === 410) {
          expiredEndpoints.push(subscriptions[i].endpoint)
          errors.push(`410: Subscription expired`)
        } else {
          errors.push(`${result.value.status}: ${result.value.body}`)
        }
      } else {
        errors.push(result.reason?.message || 'unknown error')
      }
    })

    if (expiredEndpoints.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
    }

    return jsonResponse({ ok: true, sent, total: subscriptions.length, errors })
  } catch (error) {
    console.error('Erro send-push-notification:', error)
    return jsonResponse(
      { ok: false, error: error instanceof Error ? error.message : 'Erro inesperado.' },
      500,
    )
  }
})
