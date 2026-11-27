// Web Push with nothing but WebCrypto, so the same file runs in the `push`
// edge function (Deno) and in Node tests.
//
//   - payload encryption: RFC 8291 (aes128gcm content coding, RFC 8188)
//   - sender identity:    RFC 8292 (VAPID, an ES256-signed JWT)
//
// keys = { publicKey, privateKey } as base64url: the 65-byte uncompressed P-256
// public point and the 32-byte private scalar (scripts/push/vapid-keys.mjs).

const enc = new TextEncoder()

export function b64url(bytes) {
  let s = ''
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function unb64url(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4))
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8))
}

// Encrypts `payload` (bytes) for one browser subscription. Returns the body to POST.
export async function encryptPayload(payload, p256dh, authSecret) {
  const uaPublic = unb64url(p256dh)
  const auth = unb64url(authSecret)
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256))

  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  // One record: the payload, then the 0x02 "last record" delimiter.
  const plain = concat(payload, new Uint8Array([2]))
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain))

  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, 4096)
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed)
}

const signingKeys = new Map()
async function signingKey(keys) {
  if (!signingKeys.has(keys.privateKey)) {
    const pub = unb64url(keys.publicKey)
    const jwk = { kty: 'EC', crv: 'P-256', d: keys.privateKey, x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), ext: true }
    signingKeys.set(keys.privateKey, crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']))
  }
  return signingKeys.get(keys.privateKey)
}

// The Authorization header that proves the push comes from us.
export async function vapidHeader(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin
  const head = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })))
  const unsigned = `${head}.${body}`
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await signingKey(keys), enc.encode(unsigned))
  return `vapid t=${unsigned}.${b64url(sig)}, k=${keys.publicKey}`
}

// Sends one notification. `message` is any JSON the service worker understands.
// Resolves to { ok, status, gone } — gone means the subscription is dead (the
// app was deleted or notifications turned off) and should be forgotten.
export async function sendPush(sub, message, keys, { subject, ttl = 3600, urgency = 'high', topic } = {}) {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth)
  const headers = {
    Authorization: await vapidHeader(sub.endpoint, keys, subject),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(ttl),
    Urgency: urgency,
  }
  if (topic) headers.Topic = topic
  const res = await fetch(sub.endpoint, { method: 'POST', headers, body })
  const text = res.ok ? '' : await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, text: text.slice(0, 200) }
}
