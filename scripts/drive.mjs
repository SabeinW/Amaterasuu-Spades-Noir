import { chromium } from 'playwright'
import fs from 'node:fs'

const shotDir = new URL('./shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:')
fs.mkdirSync(shotDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 860 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('console.error: ' + msg.text())
})

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Amaterasuu')
await page.screenshot({ path: `${shotDir}01-landing.png` })

await page.click('text=Quick Game vs AI')
await page.waitForTimeout(1000)
await page.screenshot({ path: `${shotDir}02-dealing.png` })

await page.waitForSelector('text=How many tricks?', { timeout: 8000 })
await page.screenshot({ path: `${shotDir}03-bidding.png` })

await page.click('button:text-is("4")')
await page.click('button:has-text("Confirm bid")')
await page.waitForTimeout(500)
await page.screenshot({ path: `${shotDir}04-bid-submitted.png` })

await page.waitForSelector('text=Leave Match', { timeout: 10000 })
await page.screenshot({ path: `${shotDir}05-play-phase.png` })

// play the first enabled card in hand (whatever is legal to lead)
await page.locator('[data-testid="hand-row"] button:not([disabled])').first().click({ timeout: 5000 })

for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(1000)
  const trickCount = await page.locator('.z-20').count()
  const seatText = await page.locator('.z-10').allTextContents()
  console.log(`t+${i + 1}s trickCards=${trickCount} seats=${JSON.stringify(seatText)}`)
  await page.screenshot({ path: `${shotDir}step-${i}.png` })
}

console.log('ERRORS:', JSON.stringify(errors, null, 2))
await browser.close()
