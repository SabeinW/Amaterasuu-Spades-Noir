// Push notifications end to end, against the LOCAL stack: a real Chrome turns
// notifications on through the app (a real push subscription with Google's
// push service), then a friend's invite and friend request reach it through
// the `push` edge function, and the service worker shows them.
//   node scripts/ui-push.mjs [baseUrl]   (a dev server pointed at the local stack)
// Needs the local Vault secret `vapid_keys` (see the 20261128 migration).
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { KEY, URL, emailFor, storageKey, usernameFor, PROD } from './test-target.mjs'

if (PROD) throw new Error('Run this against the local stack only.')
const base = process.argv[2] ?? 'http://127.0.0.1:5191'
let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

async function account(label) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  const username = usernameFor(label)
  await c.from('profiles').insert({ id: data.user.id, email, username })
  return { c, id: data.user.id, session: data.session, username }
}
const [A, B, C] = await Promise.all([account('pushhost'), account('pushfriend'), account('stranger')])

// Push needs a normal browser profile: Chrome refuses it in private-style contexts.
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-test-'))
const ctx = await chromium.launchPersistentContext(profileDir, { executablePath: '/usr/bin/google-chrome', headless: true, viewport: { width: 393, height: 852 } })
const browser = ctx
await ctx.grantPermissions(['notifications'], { origin: base })
await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(B.session)])
const page = ctx.pages()[0] ?? (await ctx.newPage())
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base, { waitUntil: 'networkidle' })

// The home-screen nudge turns notifications on and sends a test.
const turnOn = page.getByRole('button', { name: 'Turn on notifications' })
await turnOn.waitFor({ timeout: 15000 })
ok('home screen offers notifications to a signed-in player', true)
await turnOn.click()
await page.getByText(/Notifications are on/).first().waitFor({ timeout: 20000 }).catch(() => {})
const banner = await page.locator('p').filter({ hasText: /Notifications are on|blocked|weren|aren’t ready|not a push|failed|denied/i }).last().textContent().catch(() => '')
ok('turning on works', /Notifications are on/.test(banner ?? ''), banner)
const { data: subs } = await B.c.from('push_subscriptions').select('endpoint')
ok('this device is saved for the player', subs?.length === 1, subs?.[0]?.endpoint?.slice(0, 40))

const shown = async (match, ms = 20000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const list = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, url: n.data?.url })))
    const hit = list.find((n) => match.test(`${n.title} ${n.body}`))
    if (hit) return hit
    await page.waitForTimeout(500)
  }
  return null
}
ok('the test notification arrives', !!(await shown(/Notifications are on/)))

// Friends: A asks, B gets a ping; B accepts, A has no device so nothing breaks.
const { data: req } = await A.c.from('friends').insert({ user_id: A.id, friend_id: B.id, status: 'pending' }).select('id').single()
const r1 = await A.c.functions.invoke('push', { body: { kind: 'friend_request', id: req.id } })
ok('friend request push sent', r1.data?.sent === 1, JSON.stringify(r1.data ?? r1.error?.message))
const n1 = await shown(/wants to add you/)
ok('friend request notification shows', !!n1, n1 && `${n1.title} · ${n1.body} · ${n1.url}`)
const again = await A.c.functions.invoke('push', { body: { kind: 'friend_request', id: req.id } })
ok('the same request is never pushed twice', again.data?.duplicate === true)
const forged = await C.c.functions.invoke('push', { body: { kind: 'friend_request', id: req.id } })
ok('someone else can’t push it', !forged.data?.sent)

await B.c.from('friends').update({ status: 'accepted' }).eq('id', req.id)
const r2 = await B.c.functions.invoke('push', { body: { kind: 'friend_accept', id: req.id } })
ok('accept push to a player with no devices is harmless', r2.data?.sent === 0 && !r2.error, JSON.stringify(r2.data))

// Table invite: A invites B to table 4821.
const { data: inv } = await A.c.from('table_invites').insert({ from_user: A.id, to_user: B.id, room_code: '4821' }).select('id').single()
const r3 = await A.c.functions.invoke('push', { body: { kind: 'invite', id: inv.id } })
ok('invite push sent', r3.data?.sent === 1, JSON.stringify(r3.data ?? r3.error?.message))
const n3 = await shown(/table 4821/)
ok('invite notification shows and opens the table', n3?.url === '/?join=4821', n3 && `${n3.title} · ${n3.body}`)

// Turning off forgets the device.
await page.getByRole('button', { name: 'Not now' }).click().catch(() => {})
await page.evaluate(async () => {
  const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
  await sub?.unsubscribe()
})
const r4 = await A.c.functions.invoke('push', { body: { kind: 'test' } })
ok('a player with no devices gets nothing', r4.data?.sent === 0)

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
fs.rmSync(profileDir, { recursive: true, force: true })
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
