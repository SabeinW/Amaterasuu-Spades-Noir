// Push notifications on this device: turning them on and off, and asking the
// `push` edge function to ping a friend after an invite or friend request.
//
// iPhones only allow web notifications for an app added to the Home Screen
// (Share → Add to Home Screen) and opened from there, so in Safari itself we
// show how to do that instead of a switch.
import { supabase, supabaseEnabled } from './supabase'
import { unb64url, b64url } from '../../supabase/functions/_shared/webpush.js'

const PROMPT_KEY = 'amaterasuu-noir-spades:push-prompt'

export const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(() => {})
  // A tapped notification while the app is open: go where it points.
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'notification-open' || !e.data.url) return
    const url = new URL(e.data.url, window.location.origin)
    if (url.origin === window.location.origin) window.location.assign(url.pathname + url.search)
  })
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/')
  return { reg, sub: (await reg?.pushManager.getSubscription()) ?? null }
}

// 'on' | 'off' | 'install' (iPhone, not on the Home Screen yet) | 'denied' | 'unsupported'
export async function pushState() {
  if (!supabaseEnabled) return 'unsupported'
  if (isIOS && !isStandalone()) return 'install'
  if (!canPush()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  const { sub } = await currentSubscription()
  return sub ? 'on' : 'off'
}

async function save(sub) {
  const j = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: navigator.userAgent })
  if (error) throw new Error(error.message)
}

// Must run straight from a tap: iPhones only show the permission question then.
export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(permission === 'denied' ? 'Notifications are blocked for this app. Turn them on in your phone’s Settings → Notifications.' : 'Notifications weren’t allowed.')
  }
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const { data, error } = await supabase.functions.invoke('push', { body: { kind: 'key' } })
  if (error || !data?.publicKey) throw new Error('Notifications aren’t ready on the server yet.')
  let sub = await reg.pushManager.getSubscription()
  const current = sub?.options?.applicationServerKey
  if (sub && current && b64url(current) !== data.publicKey) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64url(data.publicKey) })
  await save(sub)
  markPrompted()
}

export async function disablePush() {
  const { sub } = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => {})
}

// After signing in: notifications on this device now go to whoever is signed in.
export async function syncPush() {
  if (!supabaseEnabled || !canPush() || Notification.permission !== 'granted') return
  const { sub } = await currentSubscription().catch(() => ({ sub: null }))
  if (sub) await save(sub).catch(() => {})
}

// Before signing out: stop this device getting the account's notifications.
export async function forgetDevice() {
  if (!supabaseEnabled || !canPush()) return
  const { sub } = await currentSubscription().catch(() => ({ sub: null }))
  if (sub) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
}

export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('push', { body: { kind: 'test' } })
  if (error) throw new Error('The test didn’t send.')
  return data
}

// Fire and forget: a failed ping must never get in the way of the invite itself.
export function notify(kind, id) {
  if (!supabaseEnabled || !id) return
  supabase.functions.invoke('push', { body: { kind, id } }).catch(() => {})
}

export function wasPrompted() {
  try {
    return localStorage.getItem(PROMPT_KEY) === '1'
  } catch {
    return true
  }
}
export function markPrompted() {
  try {
    localStorage.setItem(PROMPT_KEY, '1')
  } catch {
    // storage unavailable: the prompt may show again, that's all
  }
}
