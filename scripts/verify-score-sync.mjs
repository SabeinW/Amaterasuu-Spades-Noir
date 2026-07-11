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

await host.click('text=Play Now')
await host.waitForTimeout(300)
await host.click('text=Create Room')
await host.waitForSelector('text=Room Code', { timeout: 8000 })
const code = (await host.locator('p.font-display.text-4xl').textContent()).trim()

// Guest joins by code — auto-seated to seat 1 ('left'), which is Team B, the
// opposite team from host's seat 0 ('bottom'/Team A). This is exactly the
// scenario where the old hardcoded "You & Partner = Team A" label bug would
// show a guest their opponent's score instead of their own.
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
async function submitBid(page) {
  // Prefer a real (non-nil) enabled number so this doesn't repeatedly
  // trigger the board-rule rebid loop by always contributing 0 to the
  // team's combined bid — fall back to Nil only if it's the sole option.
  const bidGrid = page.locator('.grid.grid-cols-7 button:not([disabled])')
  await bidGrid.first().waitFor({ timeout: 8000 })
  const count = await bidGrid.count()
  const target = count > 1 ? bidGrid.nth(1) : bidGrid.first()
  await target.click()
  await page.getByText(/confirm bid/i).click()
}
await passBlindNil(host)
await passBlindNil(guest)
await submitBid(host)
await submitBid(guest)
// Board rule can force a rebid multiple times if bots also land under the
// minimum — keep resubmitting on whichever client shows the bid panel again
// until both reach the play phase.
for (let i = 0; i < 15; i++) {
  await host.waitForTimeout(1000)
  const hostInPlay = await host.getByText('Leave Match').count() > 0
  const guestInPlay = await guest.getByText('Leave Match').count() > 0
  if (hostInPlay && guestInPlay) break
  if (!hostInPlay && await host.getByText('How many tricks?').count() > 0) await submitBid(host)
  if (!guestInPlay && await guest.getByText('How many tricks?').count() > 0) await submitBid(guest)
}

// Play out the whole round on both clients.
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
await host.screenshot({ path: shot('score-01-host-roundover') })
await guest.screenshot({ path: shot('score-02-guest-roundover') })

// Dismiss round-over and check the live top score bar on both clients.
await guest.waitForTimeout(500)

console.log('ERRORS:', JSON.stringify(errors, null, 2))
await browser.close()
