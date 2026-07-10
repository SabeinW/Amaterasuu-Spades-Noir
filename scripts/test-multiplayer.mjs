import { chromium } from 'playwright'
import fs from 'node:fs'

const shotDir = new URL('./shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]):/, '$1:')
fs.mkdirSync(shotDir, { recursive: true })

const HOST = { email: 'mptest1783420099677@gmail.com', password: 'Test1234!' }
const GUEST = { email: 'mp-guest-1783420192@gmail.com', password: 'Test1234!' }

const browser = await chromium.launch()
const hostCtx = await browser.newContext({ viewport: { width: 420, height: 860 } })
const guestCtx = await browser.newContext({ viewport: { width: 420, height: 860 } })
const host = await hostCtx.newPage()
const guest = await guestCtx.newPage()

const errors = []
for (const [name, page] of [['host', host], ['guest', guest]]) {
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${name} console.error: ${msg.text()}`)
    if (msg.text().includes('[debug]')) console.log(`${name}:`, msg.text())
  })
}

async function signIn(page, creds) {
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' })
  await page.click('text=Sign In')
  await page.fill('input[type="email"]', creds.email)
  await page.fill('input[type="password"]', creds.password)
  await page.click('button:has-text("Enter the Game")')
  await page.waitForTimeout(1500)
}

await signIn(host, HOST)
await host.screenshot({ path: `${shotDir}mp-01-host-signed-in.png` })

await signIn(guest, GUEST)
await guest.screenshot({ path: `${shotDir}mp-02-guest-signed-in.png` })

// Host creates a room
await host.click('text=Play Now')
await host.waitForTimeout(300)
await host.click('text=Create Room')
await host.waitForSelector('text=Room Code', { timeout: 8000 })
const code = (await host.locator('p.font-display.text-4xl').textContent()).trim()
console.log('Room code:', code)
await host.screenshot({ path: `${shotDir}mp-03-host-room-waiting.png` })

// Guest joins by code
await guest.click('text=Play Now')
await guest.waitForTimeout(300)
await guest.fill('input[placeholder="Code"]', code)
await guest.click('button:has-text("Join")')
await guest.waitForSelector('text=Room Code', { timeout: 8000 })
await guest.screenshot({ path: `${shotDir}mp-04-guest-room-waiting.png` })

await host.waitForTimeout(1500)
await host.screenshot({ path: `${shotDir}mp-05-host-sees-guest.png` })

// Host starts the game (fills remaining seats with bots)
await host.click('button:has-text("Start Game")')
await host.waitForSelector('[data-testid="hand-row"]', { timeout: 10000 })
await host.screenshot({ path: `${shotDir}mp-06-host-game-started.png` })

await guest.waitForSelector('[data-testid="hand-row"]', { timeout: 10000 })
await guest.screenshot({ path: `${shotDir}mp-07-guest-game-started.png` })

// Both real players bid (bots bid on their own timers)
await host.waitForSelector('text=How many tricks?', { timeout: 8000 })
await host.locator('button:text-is("5")').click()
await host.click('button:has-text("Confirm bid")')

await guest.waitForSelector('text=How many tricks?', { timeout: 8000 })
await guest.locator('button:text-is("3")').click()
await guest.click('button:has-text("Confirm bid")')

await host.waitForSelector('text=Leave Match', { timeout: 20000 })
await guest.waitForSelector('text=Leave Match', { timeout: 20000 })
await host.screenshot({ path: `${shotDir}mp-08-host-play-phase.png` })
await guest.screenshot({ path: `${shotDir}mp-09-guest-play-phase.png` })

// Whoever's turn it is (data position 'bottom' = host/seat0) plays first
await host.locator('[data-testid="hand-row"] button:not([disabled])').first().click({ timeout: 5000 })
await host.waitForTimeout(1500)
await host.screenshot({ path: `${shotDir}mp-10-host-after-lead.png` })
await guest.screenshot({ path: `${shotDir}mp-11-guest-sees-lead.png` })

console.log('ERRORS:', JSON.stringify(errors, null, 2))
await browser.close()
