// Drives a practice game in a real browser and saves screenshots.
//   node scripts/ui-practice.mjs [baseUrl] [outDir] [width] [height]
import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:5180'
const out = process.argv[3] ?? 'scripts/shots/v2'
const width = Number(process.argv[4] ?? 390)
const height = Number(process.argv[5] ?? 844)
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: width < 600, isMobile: width < 600 })
const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))

const shot = (name) => page.screenshot({ path: `${out}/${width}x${height}-${name}.png` })
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await shot('01-landing')

await page.getByRole('button', { name: /Practice vs AI/ }).click()
await page.waitForTimeout(700)
await shot('02-dealing')
await page.waitForTimeout(1900)
await shot('03-dealt')

// Play the whole first round, choosing legal cards, until the round summary.
let guard = 0
let midShot = false
while (guard++ < 300) {
  if (await page.getByRole('button', { name: /Deal next round/ }).isVisible().catch(() => false)) break
  const bidBtn = page.getByRole('button', { name: /^Bid / })
  if (await bidBtn.isVisible().catch(() => false)) {
    await shot('04-bidding')
    await bidBtn.click()
    await page.waitForTimeout(400)
    continue
  }
  const look = page.getByRole('button', { name: /Look at cards/ })
  if (await look.isVisible().catch(() => false)) {
    await look.click()
    continue
  }
  // A legal card is one whose card face isn't dimmed (the hand marks illegal ones with brightness filter).
  const cards = page.locator('[data-card]')
  const n = await cards.count()
  let played = false
  for (let i = 0; i < n; i++) {
    const el = cards.nth(i)
    const dim = await el.locator('> *').evaluate((node) => getComputedStyle(node).filter.includes('brightness'), null, { timeout: 800 }).catch(() => true)
    const cursor = await el.evaluate((node) => getComputedStyle(node).cursor, null, { timeout: 800 }).catch(() => 'default')
    if (!dim && cursor === 'pointer') {
      await el.dispatchEvent('click')
      await page.waitForTimeout(150)
      if (width < 600) await el.dispatchEvent('click') // touch: tap to lift, tap again to play
      played = true
      break
    }
  }
  if (played && !midShot && guard > 6) {
    await page.waitForTimeout(260)
    await shot('05-trick-in-flight')
    midShot = true
  }
  await page.waitForTimeout(played ? 900 : 500)
}
await page.waitForTimeout(800)
await shot('06-round-summary')
await page.getByRole('button', { name: /Deal next round/ }).click().catch(() => {})
await page.waitForTimeout(900)
await shot('07-next-deal')

console.log(errors.length ? errors.join('\n') : 'no console errors')
await browser.close()
