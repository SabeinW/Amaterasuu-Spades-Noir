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

// Host does NOT move seats (matches the earlier-reported join bug scenario).
await host.click('text=Play Now')
await host.waitForTimeout(300)
await host.click('text=Create Room')
await host.waitForSelector('text=Room Code', { timeout: 8000 })
const code = (await host.locator('p.font-display.text-4xl').textContent()).trim()
console.log('Room code:', code)

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
// Bid deliberately high (host 8, guest 8) to reliably push the combined
// total over 13, testing the "someone's lying" popup on both clients.
await submitBid(host, 8)
await submitBid(guest, 8)

for (let i = 0; i < 10; i++) {
  await host.waitForTimeout(1000)
  if (await host.getByText('Leave Match').count() > 0) break
}
await host.screenshot({ path: shot('final3-01-host-bidnotice') })
await guest.screenshot({ path: shot('final3-02-guest-bidnotice') })

// Check the notice is still visible after 8s (was previously bugged to get
// stuck forever OR disappear too early at 5s) — should still be up now
// (10s duration) and gone shortly after.
await host.waitForTimeout(3000)
const stillVisibleAt11s = await host.getByText(/bids on|tricks up for grabs|leavin.*tricks/i).count()
await host.waitForTimeout(8000)
const goneBy19s = await host.getByText(/bids on|tricks up for grabs|leavin.*tricks/i).count()
console.log('notice state at ~11s (expect some form still may have juuust cleared, informational):', stillVisibleAt11s)
console.log('notice gone by ~19s (expect 0 - confirms it does NOT stay stuck forever):', goneBy19s)

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
await host.screenshot({ path: shot('final3-03-roundover') })

console.log('ERRORS:', JSON.stringify(errors, null, 2))
await browser.close()
