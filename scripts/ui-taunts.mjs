// Table talk in a practice game: the tray, every tab, a line bubble and an
// emoji over your seat, the spam limit, and the bots talking back.
//   node scripts/ui-taunts.mjs [baseUrl] [width] [height]
import { chromium } from 'playwright'
import fs from 'node:fs'

const base = process.argv[2] ?? 'http://127.0.0.1:5191'
const width = Number(process.argv[3] ?? 393)
const height = Number(process.argv[4] ?? 852)
const out = 'scripts/shots/taunts'
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
const shot = (name) => page.screenshot({ path: `${out}/${width}x${height}-${name}.png` })

await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Practice vs AI/ }).click()
await page.waitForTimeout(3200)

// Bidding first, so the bid panel is out of the way.
for (let i = 0; i < 40; i++) {
  const look = page.getByRole('button', { name: /Look at cards/ })
  if (await look.isVisible().catch(() => false)) await look.click()
  const bid = page.getByRole('button', { name: /^Bid / })
  if (await bid.isVisible().catch(() => false)) {
    await bid.click()
    break
  }
  await page.waitForTimeout(400)
}
await page.waitForTimeout(800)

const button = page.getByRole('button', { name: 'Trash talk', exact: true })
ok('the trash-talk button sits by your seat', await button.isVisible())
await button.click()
await page.waitForTimeout(300)
const tabs = await page.getByRole('tab').allTextContents()
ok('the tray has its tabs', ['Trash talk', 'Lines', 'Hype', 'Reactions'].every((t) => tabs.includes(t)), tabs.join(' · '))
for (const t of ['Trash talk', 'Lines', 'Hype', 'Reactions']) {
  await page.getByRole('tab', { name: t }).click()
  await page.waitForTimeout(150)
  await shot(`tray-${t.replace(/\s/g, '-').toLowerCase()}`)
}
const hands = await page.getByRole('tab', { name: 'Hype' }).click().then(() => page.locator('button[aria-label="Send 👏"]').textContent())
ok('hands come in the default brown tone', hands === '👏🏾', hands)

// A line over your seat.
await page.getByRole('tab', { name: 'Lines' }).click()
await page.getByRole('button', { name: /Who taught you to play/ }).click()
await page.waitForTimeout(450)
ok('the tray closes after a pick', !(await page.getByRole('tab').first().isVisible().catch(() => false)))
const bubble = page.locator('span.max-w-\\[168px\\]', { hasText: 'Who taught you to play?' })
ok('your line shows in a bubble', await bubble.isVisible())
await shot('line-mine')

// Too fast: a second pick right on top of the first is held back.
await page.waitForTimeout(800)
for (const e of ['🤡', '💀']) {
  await button.click()
  await page.getByRole('tab', { name: 'Trash talk' }).click()
  await page.locator(`button[aria-label="Send ${e}"]`).click()
}
await page.waitForTimeout(150)
ok('spamming is held back', await page.getByText(/let them read that one first/).isVisible().catch(() => false))
ok('…and the tray stays open to try again', await page.getByRole('tab').first().isVisible().catch(() => false))
await page.getByRole('button', { name: 'Close trash talk' }).click({ position: { x: 12, y: height * 0.3 } })
await page.waitForTimeout(3200)

// Tapping off the tray closes it without playing a card.
await button.click()
await page.waitForTimeout(250)
const before = await page.locator('[data-card]').count()
await page.mouse.click(12, height * 0.3)
await page.waitForTimeout(400)
ok('tapping off the tray closes it', !(await page.getByRole('tab').first().isVisible().catch(() => false)))
ok('…and plays no card', (await page.locator('[data-card]').count()) === before)

// The bots talk back to trash talk (often, not always).
const botSeen = new Set()
for (let i = 0; i < 14 && botSeen.size < 2; i++) {
  await button.click()
  await page.getByRole('tab', { name: i % 2 ? 'Trash talk' : 'Lines' }).click()
  if (i % 2) await page.locator('button[aria-label="Send 🥱"]').click()
  else await page.getByRole('button', { name: /Sit down, rookie/ }).click()
  for (let t = 0; t < 12; t++) {
    await page.waitForTimeout(250)
    const shown = await page.evaluate(() =>
      [...document.querySelectorAll('span.max-w-\\[168px\\], span.text-\\[38px\\]')].map((el) => {
        const r = el.getBoundingClientRect()
        return { text: el.textContent, x: r.x, y: r.y, w: r.width, h: r.height }
      })
    )
    const theirs = shown.filter((s) => !/Sit down|🥱/.test(s.text))
    if (theirs.length) console.log('  bot said', theirs.map((s) => s.text).join(' / '))
    if (theirs.length) {
      const s = theirs[0]
      const kind = s.text.length > 4 ? 'line' : 'emoji'
      if (!botSeen.has(kind)) {
        botSeen.add(kind)
        ok(`a bot ${kind} stays on screen`, s.x >= 0 && s.y >= 0 && s.x + s.w <= width && s.y + s.h <= height, `${s.text} at ${Math.round(s.x)},${Math.round(s.y)} ${Math.round(s.w)}×${Math.round(s.h)}`)
        await shot(`bot-${kind}`)
      }
      break
    }
  }
  await page.waitForTimeout(3300)
}
ok('a bot talked back', botSeen.size > 0, [...botSeen].join(', '))

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
