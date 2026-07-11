import { chromium } from 'playwright'

const shot = (name) => `C:/Users/rahee/AppData/Local/Temp/claude/c--Users-rahee-Downloads-amaterasuu-noir-spades/c82645b3-4403-44c2-b282-ced0cf38aa5c/scratchpad/${name}.png`

const HOST = { email: process.argv[2], password: 'Test1234!' }
const GUEST = { email: process.argv[3], password: 'Test1234!' }

const browser = await chromium.launch()
const hostCtx = await browser.newContext({ viewport: { width: 420, height: 860 } })
const guestCtx = await browser.newContext({ viewport: { width: 420, height: 860 } })
const host = await hostCtx.newPage()
const guest = await guestCtx.newPage()

const errors = []
for (const [name, page] of [['host', host], ['guest', guest]]) {
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`${name} console: ${msg.text()}`) })
}

async function signIn(page, creds) {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  await page.click('button[aria-label="Sign In"]')
  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.click('button:has-text("Enter the Game")')
  await page.waitForTimeout(1500)
}

await signIn(host, HOST)
await signIn(guest, GUEST)

// Disable board rule so bidding always completes on the first attempt.
await host.locator('button[aria-label="Game Rules"]').click()
await host.waitForTimeout(300)
const boardRow = host.getByText('Board Rule', { exact: true }).locator('xpath=ancestor::div[contains(@class,"items-center")][1]')
await boardRow.locator('button').click()
await host.getByText('Save Rules').click()
await host.waitForTimeout(300)

await host.click('text=Play Now')
await host.waitForTimeout(300)
await host.click('text=Create Room')
await host.waitForSelector('text=Room Code', { timeout: 8000 })
const code = (await host.locator('p.font-display.text-4xl').textContent()).trim()

await guest.click('text=Play Now')
await guest.waitForTimeout(300)
await guest.fill('input[placeholder="Code"]', code)
await guest.click('button:has-text("Join")')
await guest.waitForSelector('text=Room Code', { timeout: 8000 })

await host.waitForSelector('text=mp-guest-', { timeout: 15000 })
await host.click('button:has-text("Start Game")')
await host.waitForSelector('[data-testid="hand-row"]', { timeout: 10000 })

async function passBlindNil(page) {
  await Promise.race([
    page.waitForSelector('text=See My Hand First', { timeout: 12000 }).catch(() => {}),
    page.waitForSelector('text=How many tricks?', { timeout: 12000 }).catch(() => {}),
  ])
  const seeHand = page.getByText('See My Hand First')
  if (await seeHand.count()) await seeHand.click()
}
async function submitBid(page, n) {
  await page.locator('.grid.grid-cols-7 button', { hasText: new RegExp(`^${n}$`) }).click()
  await page.getByText(/confirm bid/i).click()
}
await passBlindNil(host)
await passBlindNil(guest)
// Deliberately bid high on purpose to try to trigger the "over 13" funny popup.
await submitBid(host, 6)
await submitBid(guest, 6)

for (let i = 0; i < 10; i++) {
  await host.waitForTimeout(1000)
  if (await host.getByText('Leave Match').count() > 0) break
}

// Check for the funny total-bid popup (may have already faded by now).
await host.screenshot({ path: shot('final-01-host-after-bid') })
await guest.screenshot({ path: shot('final-02-guest-after-bid') })

async function playIfMyTurn(page) {
  const count = await page.locator('[data-testid="hand-row"] button:not([disabled])').count()
  if (count > 0) {
    await page.locator('[data-testid="hand-row"] button:not([disabled])').first().click({ timeout: 5000 })
    return true
  }
  return false
}
for (let i = 0; i < 220; i++) {
  if (await host.getByText('Round Complete').count() > 0) break
  await playIfMyTurn(host)
  await playIfMyTurn(guest)
  await host.waitForTimeout(500)
}

const reachedRoundOver = await host.waitForSelector('text=Round Complete', { timeout: 25000 }).then(() => true).catch(() => false)
console.log('reached Round Complete:', reachedRoundOver)
await host.screenshot({ path: shot('final-03-host-roundover') })
await guest.screenshot({ path: shot('final-04-guest-roundover') })

console.log('ERRORS:', JSON.stringify(errors, null, 2))
await browser.close()
