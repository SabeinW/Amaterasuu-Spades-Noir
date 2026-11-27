// Your own stickers, end to end against the LOCAL stack: add from Photos
// (shrunk to 320px, small GIFs kept animated), paste one in, a keyboard-style
// sticker dropped into the paste box, throw one at the table, delete one; and
// the storage rules (nobody else can add to, list or delete your stickers;
// 40 at most). GIPHY is played by scripts/giphy-mock.mjs.
//   VITE_GIPHY_KEY=test-key npx vite --port 5197   (dev server on the local stack)
//   node scripts/ui-stickers.mjs [baseUrl]
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { KEY, URL as SB_URL, emailFor, storageKey, usernameFor, PROD } from './test-target.mjs'
import { mockGiphy } from './giphy-mock.mjs'

if (PROD) throw new Error('Run this against the local stack only.')
const base = process.argv[2] ?? 'http://127.0.0.1:5197'
const out = 'scripts/shots/stickers'
fs.mkdirSync(out, { recursive: true })
let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

async function account(label) {
  const c = createClient(SB_URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  await c.from('profiles').insert({ id: data.user.id, email, username: usernameFor(label) })
  return { c, id: data.user.id, session: data.session }
}
const [A, B] = await Promise.all([account('stickers'), account('snoop')])
const mine = async () => (await A.c.storage.from('stickers').list(A.id)).data ?? []

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
await mockGiphy(ctx)
await ctx.addInitScript(([key, value]) => {
  localStorage.setItem(key, value)
  localStorage.setItem('amaterasuu-noir-spades:preferences', JSON.stringify({ gameSettings: { jokers: true, blindNil: false } }))
}, [storageKey, JSON.stringify(A.session)])
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` })

await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Practice vs AI/ }).click()
await page.waitForTimeout(3500)
for (let i = 0; i < 40; i++) {
  const bid = page.getByRole('button', { name: /^Bid / })
  if (await bid.isVisible().catch(() => false)) {
    await bid.click({ timeout: 2000 }).catch(() => {})
    break
  }
  await page.waitForTimeout(400)
}
await page.waitForTimeout(900)
const openMine = async () => {
  await page.getByRole('button', { name: 'Trash talk', exact: true }).click()
  await page.getByRole('button', { name: 'GIFs', exact: true }).click()
  await page.getByRole('tab', { name: 'Mine' }).click()
}
await openMine()
await page.getByText('No stickers yet').waitFor({ timeout: 8000 })
ok('Mine starts empty for a new player', true)
ok('no GIPHY credit on your own stickers', !(await page.getByAltText('Powered by GIPHY').isVisible()))

// Add from Photos: a big photo, a small animated GIF, a sticker.
await page.locator('input[type=file]').setInputFiles(['scripts/fixtures/photo-sample.jpg', 'scripts/fixtures/anim-sample.gif', 'scripts/fixtures/sticker-sample.webp'])
await page.getByText('3 stickers saved.').waitFor({ timeout: 15000 })
let files = await mine()
ok('three pictures saved to your folder', files.length === 3, files.map((f) => f.name.split('_')[1]).join(', '))
const photo = files.find((f) => /_320x240\./.test(f.name))
ok('the big photo was shrunk to 320×240', !!photo, photo?.name.split('_')[1])
ok('…and is small', photo && photo.metadata.size < 60_000, photo && `${photo.metadata.size} bytes`)
ok('the small GIF stayed a GIF (still animated)', files.some((f) => f.name.endsWith('.gif')))
await shot('mine-added')

// Paste a copied picture.
const png = fs.readFileSync('scripts/fixtures/paste-sample.png').toString('base64')
await page.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
  const dt = new DataTransfer()
  dt.items.add(new File([bytes], 'sticker.png', { type: 'image/png' }))
  document.querySelector('[aria-label="Paste a sticker"]').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
}, png)
await page.getByText('Saved. Tap it to throw it.').waitFor({ timeout: 10000 })
ok('a pasted picture is saved', (await mine()).length === 4)

// A keyboard-style sticker: an <img> dropped straight into the paste box.
await page.evaluate((b64) => {
  const box = document.querySelector('[aria-label="Paste a sticker"]')
  box.innerHTML = `<img src="data:image/png;base64,${b64}">`
  box.dispatchEvent(new InputEvent('input', { bubbles: true }))
}, png)
await page.waitForFunction(() => /Your stickers · 5 of 40/i.test(document.body.innerText), null, { timeout: 10000 })
ok('a sticker dropped in by the keyboard is saved', (await mine()).length === 5)
ok('the paste box is cleared after', (await page.locator('[aria-label="Paste a sticker"]').innerHTML()) === '')
await shot('mine-five')

// Throw one at the table.
await page.getByRole('button', { name: 'Send your sticker' }).first().click()
await page.waitForTimeout(600)
const pop = page.locator(`span.absolute img[src*="/storage/v1/object/public/stickers/${A.id}/"]`)
ok('your sticker pops up over your seat', await pop.first().isVisible())
await page.waitForFunction((id) => { const i = document.querySelector(`span.absolute img[src*="/stickers/${id}/"]`); return i && i.complete && i.naturalWidth > 0 }, A.id, { timeout: 8000 }).catch(() => {})
await shot('sticker-sent')
await page.waitForTimeout(4600)

// Delete one.
await openMine()
await page.getByRole('button', { name: 'Edit' }).click()
await page.getByRole('button', { name: 'Delete this sticker' }).first().click()
await page.waitForFunction(() => /Your stickers · 4 of 40/i.test(document.body.innerText), null, { timeout: 8000 })
ok('deleting removes it from your folder', (await mine()).length === 4)

// Storage rules, straight against the API.
const tiny = fs.readFileSync('scripts/fixtures/paste-sample.png')
const sneak = await B.c.storage.from('stickers').upload(`${A.id}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa_100x100.png`, tiny, { contentType: 'image/png' })
ok('nobody can add to your stickers', !!sneak.error)
const peek = await B.c.storage.from('stickers').list(A.id)
ok('nobody else can list your stickers', (peek.data ?? []).length === 0)
const victim = (await mine())[0]
await B.c.storage.from('stickers').remove([`${A.id}/${victim.name}`])
ok('nobody else can delete your stickers', (await mine()).length === 4)
const notPic = await A.c.storage.from('stickers').upload(`${A.id}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb_100x100.png`, Buffer.from('<script>alert(1)</script>'), { contentType: 'text/html' })
ok('only pictures are allowed', !!notPic.error)
const fill = []
for (let i = (await mine()).length; i < 40; i++) fill.push(A.c.storage.from('stickers').upload(`${A.id}/${crypto.randomUUID()}_100x100.png`, tiny, { contentType: 'image/png' }))
await Promise.all(fill)
const over = await A.c.storage.from('stickers').upload(`${A.id}/${crypto.randomUUID()}_100x100.png`, tiny, { contentType: 'image/png' })
ok('40 stickers is the most', !!over.error && (await mine()).length === 40, `${(await mine()).length} saved`)

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
