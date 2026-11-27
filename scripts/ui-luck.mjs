// "Dealt this round" and the game's luck tally, in a short practice game
// (first to 120) played through to the final screen.
//   node scripts/ui-luck.mjs [baseUrl] [width] [height]
import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://127.0.0.1:5191'
const width = Number(process.argv[3] ?? 393)
const height = Number(process.argv[4] ?? 852)
const out = 'scripts/shots/luck'
fs.mkdirSync(out, { recursive: true })
const phone = width < 600

let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.addInitScript(() => localStorage.setItem('amaterasuu-noir-spades:preferences', JSON.stringify({ gameSettings: { winScore: 120, jokers: true, blindNil: false } })))
const shot = (name) => page.screenshot({ path: `${out}/${width}x${height}-${name}.png` })

await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Practice vs AI/ }).click()
await page.waitForTimeout(3000)

async function step() {
  const bid = page.getByRole('button', { name: /^Bid / })
  if (await bid.isVisible().catch(() => false)) {
    await bid.click({ timeout: 2000 }).catch(() => {})
    return
  }
  const cards = page.locator('[data-card]')
  const n = await cards.count()
  for (let i = 0; i < n; i++) {
    const el = cards.nth(i)
    const playable = await el.evaluate((node) => getComputedStyle(node).cursor === 'pointer' && !getComputedStyle(node.firstElementChild).filter.includes('brightness')).catch(() => false)
    if (playable) {
      await el.dispatchEvent('click')
      await page.waitForTimeout(120)
      if (phone) await el.dispatchEvent('click')
      return
    }
  }
}

let rounds = 0
for (let i = 0; i < 2500; i++) {
  if (await page.getByText('Cards dealt this game').isVisible().catch(() => false)) break
  const next = page.getByRole('button', { name: /Deal next round/ })
  if (await next.isVisible().catch(() => false)) {
    rounds++
    await page.waitForTimeout(600)
    const box = page.locator('[data-luck="round"]')
    const text = await box.innerText().catch(() => '')
    const spades = (await box.locator('span.w-8.font-display').allInnerTexts()).map((t) => parseInt(t, 10))
    ok(`round ${rounds}: everyone's deal is listed`, spades.length === 4, spades.join(' + '))
    ok(`round ${rounds}: the spades add up to 16`, spades.reduce((a, b) => a + b, 0) === 16)
    if (rounds >= 2) ok(`round ${rounds}: the game tally shows`, /This game so far \(\d+ rounds\)/.test(text))
    await shot(`round-${rounds}`)
    await next.click({ timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(1500)
    continue
  }
  await step()
  await page.waitForTimeout(160)
}
const final = await page.getByText('Cards dealt this game').isVisible().catch(() => false)
ok('the final screen shows the whole game’s cards', final)
if (final) {
  await page.waitForTimeout(800)
  await shot('final')
  const text = await page.locator('[data-luck="game"]').innerText()
  const box = page.locator('[data-luck="game"]')
  const total = (await box.locator('span.w-12.font-display').allInnerTexts()).reduce((a, t) => a + parseInt(t, 10), 0)
  const n = Number(text.match(/(\d+) rounds/)?.[1] ?? 0)
  ok('the game’s spades add up to 16 a round', total === 16 * n, `${total} over ${n} rounds`)
}
ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
