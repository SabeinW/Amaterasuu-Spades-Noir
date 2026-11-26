// Two real browsers (host + guest) play an online table through the UI
// against the LOCAL Supabase stack + `supabase functions serve`.
//   node scripts/ui-online.mjs [baseUrl] [outDir]
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5180'
const out = process.argv[3] ?? 'scripts/shots/online'
fs.mkdirSync(out, { recursive: true })
const env = Object.fromEntries(
  execSync('npx -y supabase@latest status -o env', { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
)

async function session(label) {
  const c = createClient(env.API_URL, env.ANON_KEY, { auth: { persistSession: false } })
  const email = `${label}-${Date.now()}@test.local`
  const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  await c.from('profiles').insert({ id: data.user.id, email, username: `${label}${String(Date.now()).slice(-4)}` })
  return data.session
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
const errors = []
async function player(label, sess, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), ['sb-127-auth-token', JSON.stringify(sess)])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${label}: ${m.text()}`))
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

let midHost = false
let summaries = 0
for (let i = 0; i < 700 && summaries < 2; i++) {
  const [a, b] = await Promise.all([step(host), step(guest)])
  if (!midHost && i > 25) {
    midHost = true
    await shot(host, '06-host-midround')
    await shot(guest, '07-guest-midround')
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
