// GIFs and stickers at the table, with GIPHY played by scripts/giphy-mock.mjs:
// the picker, the family filters, the search cache, sending a GIF to your
// seat, and the rate-limit message. Needs a dev server started with a key:
//   VITE_GIPHY_KEY=test-key npx vite --port 5197
//   node scripts/ui-gifs.mjs [baseUrl] [width] [height]
import { chromium } from 'playwright'
import fs from 'node:fs'
import { mockGiphy } from './giphy-mock.mjs'

const base = process.argv[2] ?? 'http://127.0.0.1:5197'
const width = Number(process.argv[3] ?? 393)
const height = Number(process.argv[4] ?? 852)
const out = 'scripts/shots/gifs'
fs.mkdirSync(out, { recursive: true })
const phone = width < 600
let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone })
const calls = await mockGiphy(ctx)
await ctx.addInitScript(() => localStorage.setItem('amaterasuu-noir-spades:preferences', JSON.stringify({ gameSettings: { jokers: true, blindNil: false } })))
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const shot = (name) => page.screenshot({ path: `${out}/${width}x${height}-${name}.png` })

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

const tray = page.getByRole('button', { name: 'Trash talk', exact: true })
await tray.click()
const gifBtn = page.getByRole('button', { name: 'GIFs', exact: true })
ok('the tray has a GIFs button', await gifBtn.isVisible())
await gifBtn.click()
await page.getByRole('dialog', { name: 'GIFs' }).waitFor({ timeout: 5000 })
ok('the GIF picker opens with GIPHY search', await page.getByPlaceholder('Search GIPHY').isVisible())
ok('it shows the Powered by GIPHY mark', await page.getByAltText('Powered by GIPHY').isVisible())
await page.locator('[role=dialog] img').first().waitFor({ timeout: 5000 })
const first = calls[0]
ok('the first search is family-rated and clip-free', first?.rating === 'g' && first?.bundle === 'messaging_non_clips' && first?.key === 'test-key', JSON.stringify(first))
ok('searches carry a random device id for GIPHY', /^[0-9a-f]{32}$/.test(first?.cid ?? ''), first?.cid)
await page.waitForTimeout(600)
ok('each GIF shown is reported as seen, once', (calls.pings ?? []).filter((p) => p.type === 'SEEN').length === 3, `${(calls.pings ?? []).filter((p) => p.type === 'SEEN').length} seen`)
const shown = await page.locator('[role=dialog] button[aria-label^="Send "] img').count()
ok('monkey and non-G results are filtered out', shown === 3, `${shown} of 5 shown`)
await shot('picker')

// A repeat search comes from the cache, not GIPHY.
const before = calls.length
await page.getByRole('button', { name: 'too easy', exact: true }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: 'mic drop', exact: true }).click()
await page.waitForTimeout(500)
ok('repeat searches use the cache', calls.length === before + 1, `${calls.length - before} new calls`)

// Blocked words never reach GIPHY.
const beforeBlocked = calls.length
await page.getByPlaceholder('Search GIPHY').fill('monkey')
await page.getByPlaceholder('Search GIPHY').press('Enter')
await page.waitForTimeout(400)
ok('a blocked search is stopped', calls.length === beforeBlocked && (await page.getByText('Try a different search.').isVisible()))

// Out of searches for the hour.
await page.getByPlaceholder('Search GIPHY').fill('limit test')
await page.getByPlaceholder('Search GIPHY').press('Enter')
await page.waitForTimeout(500)
ok('the hourly limit gets a friendly message', await page.getByText(/taking a breather/).isVisible())

// Stickers.
await page.getByRole('tab', { name: 'Stickers' }).click()
await page.getByPlaceholder('Search GIPHY').fill('')
await page.getByRole('button', { name: 'laughing', exact: true }).click()
await page.locator('[role=dialog] button[aria-label^="Send "] img').first().waitFor({ timeout: 5000 })
ok('sticker search uses the stickers endpoint', calls.some((c) => c.path.includes('/stickers/search')))
await shot('stickers')

// Back to GIFs and send one.
await page.getByRole('tab', { name: 'GIFs' }).click()
await page.getByRole('button', { name: 'too easy', exact: true }).click()
await page.waitForTimeout(400)
await page.locator('[role=dialog] button[aria-label^="Send "]').first().waitFor({ timeout: 5000 })
await page.locator('[role=dialog] button[aria-label^="Send "]').first().click()
await page.waitForTimeout(700)
ok('the picker closes after sending', !(await page.getByRole('dialog', { name: 'GIFs' }).isVisible().catch(() => false)))
await page.waitForTimeout(300)
const tail = (calls.pings ?? []).slice(-2)
ok('sending reports clicked then sent, with the same device id', tail.map((p) => p.type).join() === 'CLICK,SENT' && tail.every((p) => p.cid === first?.cid && p.ts), JSON.stringify(tail.map((p) => p.type)))
const pop = page.locator('img[src*="giphy.com/media"]').first()
ok('the GIF plays over your seat', await pop.isVisible())
const box = await pop.boundingBox()
ok('…and stays on screen', box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, box && `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}`)
await shot('sent')
await page.waitForTimeout(4600)
ok('it goes away after a few seconds', !(await page.locator('span.absolute img[src*="giphy.com/media"]').count()))

// It's in your recent picks now.
await tray.click()
await page.waitForTimeout(400)
ok('the GIF shows in your recent picks', await page.getByRole('button', { name: 'Again: GIF' }).isVisible())
// Nothing on the table draws over the open tray (the trick's winning card used to).
const covered = await page.evaluate(() => {
  const b = document.querySelector('[aria-label="Recent picks"]').getBoundingClientRect()
  const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
  return !hit?.closest('[aria-label="Recent picks"]')
})
ok('the tray sits above the trick cards', !covered)
await shot('recent')

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
