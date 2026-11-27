// The left and right players' card fans must sit below their name and bid,
// never over them. Measures every side seat through a practice round's
// opening tricks at phone, small-phone, iPad and desktop sizes.
//   node scripts/ui-side-fans.mjs [baseUrl]
import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://127.0.0.1:5191'
const sizes = [[393, 852], [375, 667], [430, 932], [768, 1024], [1280, 800]]
fs.mkdirSync('scripts/shots/fans', { recursive: true })
let failed = 0
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/google-chrome', headless: true })
for (const [width, height] of sizes) {
  const phone = width < 600
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: phone, isMobile: phone })
  await page.addInitScript(() => localStorage.setItem('amaterasuu-noir-spades:preferences', JSON.stringify({ gameSettings: { jokers: true, blindNil: false } })))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Practice vs AI/ }).click()
  await page.waitForTimeout(3500)
  let worst = -Infinity
  for (let i = 0; i < 6; i++) {
    const bid = page.getByRole('button', { name: /^Bid / })
    if (await bid.isVisible().catch(() => false)) await bid.click({ timeout: 2000 }).catch(() => {})
    // Overlap = how far the fan's highest card reaches above the bottom of the seat's name/bid panel.
    const m = await page.evaluate(() =>
      [...document.querySelectorAll('div.absolute.flex-col')]
        .filter((el) => /top-\[44%\]/.test(el.className))
        .map((seat) => {
          const panel = seat.querySelector('.panel-soft').getBoundingClientRect()
          const fan = seat.querySelector(':scope > div.relative.pointer-events-none')
          if (!fan) return null
          const top = Math.min(...[...fan.querySelectorAll('div.absolute > div')].map((c) => c.getBoundingClientRect().top))
          return panel.bottom - top
        })
        .filter((x) => x !== null)
    )
    worst = Math.max(worst, ...m)
    if (i === 0) await page.screenshot({ path: `scripts/shots/fans/${width}x${height}.png` })
    await page.waitForTimeout(700)
  }
  const pass = worst <= 1
  if (!pass) failed++
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${width}×${height}: fan reaches ${worst.toFixed(1)}px into the bid panel (≤ 1 is clear)`)
  await page.close()
}
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
