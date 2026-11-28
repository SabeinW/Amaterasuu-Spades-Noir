// Friend search shows where you already stand with each person it finds
// (Friends / Pending / Accept / Add), and a slow answer for an older search
// can't replace the newest one. Against the LOCAL stack:
//   node scripts/ui-friend-search.mjs [baseUrl]
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { KEY, URL as SB_URL, emailFor, storageKey, PROD } from './test-target.mjs'

if (PROD) throw new Error('Local stack only.')
const base = process.argv[2] ?? 'http://localhost:5197'
let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

const tag = `fs${Math.random().toString(36).slice(2, 7)}`
async function account(label) {
  const c = createClient(SB_URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  const username = `${tag} ${label}`
  await c.from('profiles').insert({ id: data.user.id, email, username })
  return { c, id: data.user.id, session: data.session, username }
}
const [me, wife, mom, asker, stranger] = await Promise.all(['me', 'wife', 'mom', 'asker', 'stranger'].map(account))
// wife: friends already · mom: I asked, she hasn't answered · asker: asked me
const { data: row } = await me.c.from('friends').insert({ user_id: me.id, friend_id: wife.id, status: 'pending' }).select('id').single()
await wife.c.from('friends').update({ status: 'accepted' }).eq('id', row.id)
await me.c.from('friends').insert({ user_id: me.id, friend_id: mom.id, status: 'pending' })
await asker.c.from('friends').insert({ user_id: asker.id, friend_id: me.id, status: 'pending' })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(me.session)])
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Profile' }).first().click()
await page.getByRole('tab', { name: 'Friends' }).click()
await page.getByText(wife.username).first().waitFor({ timeout: 8000 })

const search = page.getByPlaceholder('Search by username…')
await search.fill(tag)
const row_ = (who) => page.locator('li', { hasText: who.username }).first()
await row_(stranger).waitFor({ timeout: 8000 })
const results = page.locator('ul').first()
ok('your wife shows as Friends, not Add', await results.locator('li', { hasText: wife.username }).getByText('Friends').isVisible())
ok('…with no Add button', (await results.locator('li', { hasText: wife.username }).getByRole('button', { name: /Add/ }).count()) === 0)
ok('someone you asked shows as Pending', await results.locator('li', { hasText: mom.username }).getByText('Pending').isVisible())
ok('someone who asked you shows Accept', await results.locator('li', { hasText: asker.username }).getByRole('button', { name: /Accept/ }).isVisible())
ok('a stranger shows Add', await results.locator('li', { hasText: stranger.username }).getByRole('button', { name: /Add/ }).isVisible())
await page.screenshot({ path: 'scripts/shots/social/friend-search.png' })

await results.locator('li', { hasText: stranger.username }).getByRole('button', { name: /Add/ }).click()
ok('after Add the stranger shows Pending', await results.locator('li', { hasText: stranger.username }).getByText('Pending').waitFor({ timeout: 5000 }).then(() => true, () => false))
await results.locator('li', { hasText: asker.username }).getByRole('button', { name: /Accept/ }).click()
ok('after Accept they show as Friends', await results.locator('li', { hasText: asker.username }).getByText('Friends').waitFor({ timeout: 5000 }).then(() => true, () => false))

// AI players accept straight away.
await search.fill('Tatsu')
const tatsu = page.locator('li', { hasText: 'Tatsu' }).first()
await tatsu.waitFor({ timeout: 8000 })
if (await tatsu.getByRole('button', { name: /Add/ }).isVisible()) await tatsu.getByRole('button', { name: /Add/ }).click()
ok('Tatsu shows as Friends right after adding him', await tatsu.getByText('Friends').waitFor({ timeout: 5000 }).then(() => true, () => false))

// A slow answer for an older search ("T…") must not replace the newest one.
await page.route('**/rest/v1/profiles*', async (route) => {
  const u = decodeURIComponent(route.request().url())
  if (u.includes(`ilike.%${tag.slice(0, 3)}%`)) await new Promise((r) => setTimeout(r, 1500))
  await route.continue()
})
await search.fill('')
await search.fill(tag.slice(0, 3))
await page.waitForTimeout(150)
await search.fill('Tatsu')
await page.waitForTimeout(2200)
ok('a slow older search doesn’t replace the newest', (await page.locator('ul').first().locator('li', { hasText: wife.username }).count()) === 0 && (await page.locator('li', { hasText: 'Tatsu' }).count()) > 0)

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
