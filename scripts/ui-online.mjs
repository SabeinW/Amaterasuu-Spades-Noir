// Two real browsers (host + guest) play an online table through the UI
// against the LOCAL Supabase stack + `supabase functions serve`, or against
// the live site with TARGET=prod (see test-target.mjs).
//   node scripts/ui-online.mjs [baseUrl] [outDir]
//   TARGET=prod node scripts/ui-online.mjs https://amaterasuu-spades-noir.vercel.app scripts/shots/prod-online
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { KEY, URL, emailFor, storageKey, usernameFor } from './test-target.mjs'
import { mockGiphy } from './giphy-mock.mjs'

const base = process.argv[2] ?? 'http://localhost:5180'
const out = process.argv[3] ?? 'scripts/shots/online'
fs.mkdirSync(out, { recursive: true })

async function session(label) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  // The host picks a non-default avatar so the guest's view can prove avatars load.
  const avatar = label === 'host' ? JSON.stringify({ kind: 'art', src: '/art/avatars/tiger.webp', border: null }) : null
  await c.from('profiles').insert({ id: data.user.id, email, username: usernameFor(label), avatar_url: avatar })
  return data.session
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
const errors = []
async function player(label, sess, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(sess)])
  await mockGiphy(ctx) // only used when the dev server has a GIPHY key
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${label}: ${m.text()}`))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${label}: HTTP ${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`))
  await page.goto(url, { waitUntil: 'networkidle' })
  return page
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` })

const [hs, gs] = await Promise.all([session('host'), session('guest')])
const host = await player('host', hs, base)
await host.waitForTimeout(1200)
await host.getByRole('button', { name: /Play online/ }).click()
await host.getByRole('button', { name: /Create table/ }).click()
await host.waitForSelector('text=Table code', { timeout: 15000 })
const code = (await host.locator('p.font-display').first().textContent()).trim()
console.log('table code', code)
await shot(host, '01-host-waiting')

const guest = await player('guest', gs, `${base}/?join=${code}`)
await guest.waitForSelector('text=Table code', { timeout: 20000 })
await host.waitForTimeout(1500)
await shot(host, '02-host-sees-guest')
await shot(guest, '03-guest-waiting')

await host.getByRole('button', { name: /Start with/ }).click()
await Promise.all([host.waitForSelector('text=Us', { timeout: 20000 }), guest.waitForSelector('text=Us', { timeout: 20000 })])
await host.waitForTimeout(700)
await shot(host, '04-host-dealing')
await shot(guest, '05-guest-dealing')

async function step(page) {
  if (await page.getByRole('button', { name: /Deal next round/ }).isVisible().catch(() => false)) return 'summary'
  const look = page.getByRole('button', { name: /Look at cards/ })
  if (await look.isVisible().catch(() => false)) {
    await look.click()
    return 'acted'
  }
  const bid = page.getByRole('button', { name: /^Bid / })
  if (await bid.isVisible().catch(() => false)) {
    await bid.click()
    return 'acted'
  }
  const cards = page.locator('[data-card]')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const el = cards.nth(i)
    const ok = await el.evaluate((node) => getComputedStyle(node).cursor === 'pointer' && !getComputedStyle(node.firstElementChild).filter.includes('brightness')).catch(() => false)
    if (ok) {
      await el.dispatchEvent('click')
      await page.waitForTimeout(120)
      await el.dispatchEvent('click')
      return 'acted'
    }
  }
  return 'idle'
}

{
  await guest.waitForTimeout(1500)
  const seen = await guest.locator('img[src="/art/avatars/tiger.webp"]').count()
  console.log(`guest sees the host's chosen avatar: ${seen ? 'yes' : 'NO'}`)
  if (!seen) errors.push("guest: host's avatar missing at the table")
}

// Table talk crosses the wire: a line from the host, an emoji from the guest.
// (dispatchEvent: a bid panel may be covering someone's seat row.)
async function tableTalk() {
  const send = async (page, tab, item) => {
    await page.getByRole('button', { name: 'Trash talk', exact: true }).dispatchEvent('click')
    await page.getByRole('tab', { name: tab }).dispatchEvent('click')
    await item(page).dispatchEvent('click')
  }
  await send(host, 'Lines', (p) => p.getByRole('tabpanel').getByRole('button', { name: /getting set/ }))
  const line = await guest.locator('span.max-w-\\[168px\\]', { hasText: 'Y’all getting set.' }).waitFor({ timeout: 5000 }).then(() => true, () => false)
  console.log(`guest sees the host's trash-talk line: ${line ? 'yes' : 'NO'}`)
  if (!line) errors.push("guest: host's line never showed")
  await shot(guest, '07b-guest-sees-line')
  await send(guest, 'Hype', (p) => p.getByRole('tabpanel').locator('button[aria-label="Send 🔥"]'))
  const pop = await host.locator('span.text-\\[38px\\]', { hasText: '🔥' }).waitFor({ timeout: 5000 }).then(() => true, () => false)
  console.log(`host sees the guest's emoji: ${pop ? 'yes' : 'NO'}`)
  if (!pop) errors.push("host: guest's emoji never showed")
  // A GIF, when this build has GIPHY switched on.
  if (await host.getByRole('button', { name: 'Trash talk', exact: true }).dispatchEvent('click').then(() => host.getByRole('button', { name: 'GIFs', exact: true }).isVisible())) {
    await host.waitForTimeout(3200)
    await host.getByRole('button', { name: 'GIFs', exact: true }).dispatchEvent('click')
    await host.locator('[role=dialog] button[aria-label^="Send "]').first().waitFor({ timeout: 8000 })
    await host.locator('[role=dialog] button[aria-label^="Send "]').first().dispatchEvent('click')
    const gif = await guest.locator('span.absolute img[src*="giphy.com/media"]').waitFor({ timeout: 6000 }).then(() => true, () => false)
    console.log(`guest sees the host's GIF: ${gif ? 'yes' : 'NO'}`)
    if (!gif) errors.push("guest: host's GIF never showed")
    await shot(guest, '07c-guest-sees-gif')
  } else {
    await host.getByRole('button', { name: 'Close trash talk' }).dispatchEvent('click').catch(() => {})
  }
}

const ROUNDS = Number(process.env.ROUNDS ?? 2)
let midHost = false
let summaries = 0
for (let i = 0; i < 700 && summaries < ROUNDS; i++) {
  const [a, b] = await Promise.all([step(host), step(guest)])
  if (!midHost && i > 25) {
    midHost = true
    await shot(host, '06-host-midround')
    await shot(guest, '07-guest-midround')
    await tableTalk()
  }
  if (a === 'summary' && b === 'summary') {
    summaries++
    await shot(host, `08-host-summary-${summaries}`)
    await shot(guest, `09-guest-summary-${summaries}`)
    // compare what both players see
    const hostText = await host.locator('[role=dialog]').innerText()
    const guestText = await guest.locator('[role=dialog]').innerText()
    const nums = (t) => (t.match(/Total -?\d+/g) ?? []).join(',')
    console.log(`round ${summaries}: host sees ${nums(hostText)} | guest sees ${nums(guestText)}`)
    // Both see what everyone was dealt, and it's the same deal.
    const dealt = async (page) => (await page.locator('[data-luck="round"] span.w-8.font-display').allInnerTexts()).map((t) => parseInt(t, 10)).sort((a, b) => a - b)
    const [hd, gd] = await Promise.all([dealt(host), dealt(guest)])
    const sum = hd.reduce((a, b) => a + b, 0)
    console.log(`round ${summaries}: dealt spades host ${hd.join(',')} | guest ${gd.join(',')}`)
    if (hd.length !== 4 || hd.join() !== gd.join() || ![13, 16].includes(sum)) errors.push(`round ${summaries}: dealt box missing or different`)
    await host.getByRole('button', { name: /Deal next round/ }).click()
    await guest.getByRole('button', { name: /Deal next round/ }).click()
    await host.waitForTimeout(1500)
    if (summaries === 1) {
      await shot(host, '10-host-round2-deal')
    }
  }
  await host.waitForTimeout(a === 'idle' && b === 'idle' ? 600 : 350)
}
console.log(`summaries reached: ${summaries}`)
console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
