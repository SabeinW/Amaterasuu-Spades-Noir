// Apple stickers and Genmoji in the paste box, against the LOCAL stack.
// Safari doesn't paste these as picture files: it treats them like emoji and
// puts a <picture> in the box (Apple's HEIC sticker plus a PNG copy). This
// plays that out, a real paste with no file on the clipboard, and plain text.
//   VITE_GIPHY_KEY=test-key npx vite --port 5197   (dev server on the local stack)
//   node scripts/ui-apple-stickers.mjs [baseUrl]
//   BROWSER=webkit PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 node scripts/ui-apple-stickers.mjs
import { chromium, webkit } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { KEY, URL as SB_URL, emailFor, storageKey, usernameFor, PROD } from './test-target.mjs'
import { mockGiphy } from './giphy-mock.mjs'

if (PROD) throw new Error('Run this against the local stack only.')
const base = process.argv[2] ?? 'http://127.0.0.1:5197'
const isWebKit = process.env.BROWSER === 'webkit'
const out = 'scripts/shots/stickers'
fs.mkdirSync(out, { recursive: true })
let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

const c = createClient(SB_URL, KEY, { auth: { persistSession: false } })
const email = emailFor('apple-stickers')
const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
if (error) throw error
await c.from('profiles').insert({ id: data.user.id, email, username: usernameFor('apple-stickers') })
const uid = data.user.id
const mine = async () => (await c.storage.from('stickers').list(uid)).data ?? []

const browser = isWebKit
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: !isWebKit })
if (!isWebKit) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base })
await mockGiphy(ctx)
await ctx.addInitScript(([key, value]) => {
  localStorage.setItem(key, value)
  localStorage.setItem('amaterasuu-noir-spades:preferences', JSON.stringify({ gameSettings: { jokers: true, blindNil: false } }))
}, [storageKey, JSON.stringify(data.session)])
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

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
await page.getByRole('button', { name: 'Trash talk', exact: true }).click()
await page.getByRole('button', { name: 'GIFs', exact: true }).click()
await page.getByRole('tab', { name: 'Mine' }).click()
await page.getByText('No stickers yet').waitFor({ timeout: 8000 })

const png = fs.readFileSync('scripts/fixtures/paste-sample.png').toString('base64')
const box = page.locator('[aria-label="Paste a sticker"]')
const saved = (n) => page.waitForFunction((n) => new RegExp(`Your stickers · ${n} of 40`, 'i').test(document.body.innerText), n, { timeout: 10000 }).then(() => true, () => false)

// 1. What Safari puts in the box for an Apple sticker: a <picture> with Apple's
//    HEIC sticker as the <source> and a PNG copy as the <img>, both blob: links.
await page.evaluate((b64) => {
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
  const heic = URL.createObjectURL(new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])], { type: 'image/x-apple-adaptive-glyph' }))
  const fallback = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  const el = document.querySelector('[aria-label="Paste a sticker"]')
  el.innerHTML = `<picture><source srcset="${heic}" type="image/x-apple-adaptive-glyph"><img src="${fallback}" alt="Laughing sticker"></picture>`
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
}, png)
ok('a Safari-style Apple sticker is saved', await saved(1), (await page.locator('p[style*="color"]').first().textContent().catch(() => '')) ?? '')
ok('…from its PNG copy', (await mine()).some((f) => /\.(webp|png)$/.test(f.name)))
ok('the paste box is cleared after', (await box.innerHTML()) === '')
await page.screenshot({ path: `${out}/apple-sticker-${isWebKit ? 'webkit' : 'chrome'}.png` })

// 2. If the PNG copy won't open, the other copy is tried.
await page.waitForTimeout(400)
await page.evaluate((b64) => {
  const el = document.querySelector('[aria-label="Paste a sticker"]')
  el.innerHTML = `<picture><source srcset="data:image/png;base64,${b64} 2x" type="image/png"><img src="blob:${location.origin}/00000000-0000-4000-8000-000000000000" alt="Genmoji"></picture>`
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }))
}, png)
ok('a sticker whose PNG copy is broken still saves from its other copy', await saved(2))

// 3. A real paste with no picture file on the clipboard, only web content
//    holding the picture: the paste goes ahead and the box reads what landed.
if (!isWebKit) {
  await page.waitForTimeout(400)
  await page.evaluate(async (b64) => {
    const html = `<meta charset="utf-8"><picture><img src="data:image/png;base64,${b64}" alt="sticker"></picture>`
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob(['￼'], { type: 'text/plain' }) })])
  }, png)
  await box.click()
  await page.keyboard.press('Control+V')
  ok('a real paste with no picture file still saves the sticker', await saved(3))
} else {
  console.log('skip — real clipboard paste (headless WebKit has no clipboard permission)')
}

// 4. Plain text: told what happened, nothing saved.
const before = (await mine()).length
await page.waitForTimeout(400)
await box.click()
await page.keyboard.type('hi')
await page.getByText('That came in as text, not a picture.').waitFor({ timeout: 5000 }).then(() => ok('plain text gets a clear message', true), () => ok('plain text gets a clear message', false))
ok('…and saves nothing', (await mine()).length === before)
ok('…and the box is cleared', (await box.textContent()) === '')

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
