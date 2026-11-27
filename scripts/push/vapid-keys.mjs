// Makes a VAPID key pair for push notifications. Prints JSON to store as the
// `vapid_keys` secret in Supabase Vault (see the 20261128 push migration).
// The private key must never be committed. usage: node scripts/push/vapid-keys.mjs
import { b64url } from '../../supabase/functions/_shared/webpush.js'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = b64url(await crypto.subtle.exportKey('raw', pair.publicKey))
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey)
console.log(JSON.stringify({ publicKey, privateKey: d }))
