// The AI players in the real app, against the LOCAL stack (same setup as
// test-bots.mjs, plus a dev server with a test GIPHY key):
//   VITE_GIPHY_KEY=test-key npx vite --port 5197
//   node scripts/bots/ui-bots.mjs [baseUrl]
// You friend Jaylen, open a table, invite him from Invite friends: he shows
// up, says hi, and brings Nia. Then the game starts, you type in the chat,
// and Jaylen answers over his seat.
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { KEY, URL as SB_URL, emailFor, storageKey, usernameFor, PROD } from '../test-target.mjs'
import { mockGiphy } from '../giphy-mock.mjs'

if (PROD) throw new Error('Run this against the local stack only.')
const base = process.argv[2] ?? 'http://localhost:5197'
const out = 'scripts/shots/bots'
fs.mkdirSync(out, { recursive: true })
let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

const c = createClient(SB_URL, KEY, { auth: { persistSession: false } })
const email = emailFor('ui-bots')
const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
if (error) throw error
await c.from('profiles').insert({ id: data.user.id, email, username: usernameFor('raheem') })
const { data: bots } = await c.from('bot_accounts').select('id, persona')
const jaylenId = bots.find((b) => b.persona === 'jaylen').id
await c.from('friends').insert({ user_id: data.user.id, friend_id: jaylenId, status: 'pending' })
await c.from('friends').insert({ user_id: data.user.id, friend_id: bots.find((b) => b.persona === 'tatsu').id, status: 'pending' })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await mockGiphy(ctx)
await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(data.session)])
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('response', (r) => r.status() >= 400 && !r.url().includes('giphy') && errors.push(`HTTP ${r.status()} ${r.url().split('?')[0]}`))

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.getByRole('button', { name: /Play online/ }).click()
await page.getByRole('button', { name: /Create table/ }).click()
await page.waitForSelector('text=Table code', { timeout: 15000 })

await page.getByRole('button', { name: /Invite friends/ }).click()
const row = page.locator('li', { hasText: 'Jaylen' })
await row.waitFor({ timeout: 8000 })
ok('Jaylen is in your friends with an AI tag', await row.getByText('AI', { exact: true }).isVisible())
ok('…and it says he comes with Nia', await row.getByText('Comes with Nia').isVisible())
ok('Tatsu is marked as the boss level', await page.locator('li', { hasText: 'Tatsu' }).getByText('Boss level').isVisible())
await page.screenshot({ path: `${out}/01-invite-friends.png` })
await row.getByRole('button', { name: /Invite/ }).click()
ok('he’s on the way', await row.getByText('On the way…').waitFor({ timeout: 3000 }).then(() => true, () => false))
await page.keyboard.press('Escape')
await page.locator('[role=dialog]').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {})

const seatName = (name) => page.locator('p.text-\\[12\\.5px\\]', { hasText: name })
ok('Jaylen sits down', await seatName('Jaylen').waitFor({ timeout: 12000 }).then(() => true, () => false))
const hello = page.locator('span.max-w-\\[150px\\]', { hasText: 'Jaylen heard' })
ok('…and says hi over his seat', await hello.waitFor({ timeout: 8000 }).then(() => true, () => false))
await page.screenshot({ path: `${out}/02-jaylen-says-hi.png` })
ok('Nia comes in after him', await seatName('Nia').waitFor({ timeout: 12000 }).then(() => true, () => false))
await page.waitForTimeout(700)
await page.screenshot({ path: `${out}/03-nia-joins.png` })
const niaTeam = await page.locator('div.w-\\[104px\\]', { hasText: 'Nia' }).locator('p.uppercase').textContent()
const jayTeam = await page.locator('div.w-\\[104px\\]', { hasText: 'Jaylen' }).locator('p.uppercase').textContent()
ok('they sit together on the other team', niaTeam === 'Opponent' && jayTeam === 'Opponent', `${jayTeam}/${niaTeam}`)

await page.getByRole('button', { name: /Start with 1 AI player/ }).click()
await page.waitForSelector('text=Us', { timeout: 20000 })
await page.waitForTimeout(2500)
const look = page.getByRole('button', { name: /Look at cards/ })
if (await look.isVisible().catch(() => false)) await look.click()
await page.screenshot({ path: `${out}/04-table.png` })

// Plain table bots wear the robot badge; Jaylen and Nia don't.
const badges = await page.locator('svg.lucide-bot').count()
ok('only the plain table bot has a robot badge', badges === 1, `${badges}`)

await page.getByRole('button', { name: 'Chat' }).click()
await page.getByPlaceholder('Talk your talk…').fill('jaylen you not ready')
await page.getByRole('button', { name: 'Send', exact: true }).click()
await page.keyboard.press('Escape')
const mine = page.locator('span.max-w-\\[168px\\]', { hasText: 'jaylen you not ready' })
ok('what you type shows over your seat too', await mine.waitFor({ timeout: 4000 }).then(() => true, () => false))
const answer = page.locator('span.max-w-\\[168px\\]', { hasText: 'Jaylen heard' })
ok('Jaylen answers over his seat', await answer.waitFor({ timeout: 10000 }).then(() => true, () => false))
await page.screenshot({ path: `${out}/05-jaylen-answers.png` })
const emojiOrGif = await page.locator('span.text-\\[38px\\], img[src*="giphy"]').first().waitFor({ timeout: 5000 }).then(() => true, () => false)
console.log(`(an emoji or GIF from him too: ${emojiOrGif ? 'yes' : 'not this time'})`)
await page.getByRole('button', { name: 'Chat' }).click()
ok('his answer is in the chat', await page.locator('[role=dialog]').getByText('Jaylen heard').first().isVisible().catch(() => false))
await page.screenshot({ path: `${out}/06-chat.png` })

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
