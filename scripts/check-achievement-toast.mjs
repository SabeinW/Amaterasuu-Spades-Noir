import { chromium } from 'playwright'
const shot = (name) => `C:/Users/rahee/AppData/Local/Temp/claude/c--Users-rahee-Downloads-amaterasuu-noir-spades/c82645b3-4403-44c2-b282-ced0cf38aa5c/scratchpad/${name}.png`

const EMAIL = process.argv[2]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
await page.click('button[aria-label="Sign In"]')
await page.fill('input[type="email"]', EMAIL)
await page.fill('input[type="password"]', 'Test1234!')
await page.click('button:has-text("Enter the Game")')
await page.waitForTimeout(1500)

// Try a few rounds until Nil Master (or any achievement) pops up — bidding
// Nil and always playing the lowest legal card is a reasonable (not
// guaranteed) nil-preserving strategy.
let sawToast = false
for (let round = 0; round < 4 && !sawToast; round++) {
  await page.locator('text=/quick game/i').first().click().catch(() => {})
  await page.waitForTimeout(6000)
  const seeHand = page.getByText('See My Hand First')
  if (await seeHand.count()) await seeHand.click()
  await page.waitForTimeout(500)
  const nilTile = page.getByText('Nil', { exact: true }).first()
  if (await nilTile.count()) {
    await nilTile.click()
    await page.getByText(/confirm bid/i).click()
  }

  for (let i = 0; i < 40; i++) {
    if (await page.locator('.text-base', { hasText: /🤫|🙈/ }).count() > 0) { sawToast = true; break }
    const count = await page.locator('[data-testid="hand-row"] button:not([disabled])').count()
    if (count > 0) {
      await page.locator('[data-testid="hand-row"] button:not([disabled])').first().click({ timeout: 5000 }).catch(() => {})
    }
    await page.waitForTimeout(500)
    if (await page.getByText('Round Complete').count() > 0) break
  }
  await page.screenshot({ path: shot(`achv-round${round}-end`) })
  if (sawToast) break
  const nextRound = page.getByText('Next Round')
  if (await nextRound.count()) await nextRound.click()
  await page.waitForTimeout(500)
}

console.log('saw achievement toast:', sawToast)
console.log('errors:', JSON.stringify(errors))
await browser.close()
