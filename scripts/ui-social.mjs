// Levels, achievements, leaderboards and friend invites through the UI, with
// two real browsers, against the LOCAL Supabase stack (or TARGET=prod, see
// test-target.mjs). The host invites a friend to a table; the friend sees the
// pop-up and joins.
//   node scripts/ui-social.mjs [baseUrl] [outDir]
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { KEY, URL, emailFor, storageKey, usernameFor } from './test-target.mjs'

const base = process.argv[2] ?? 'http://localhost:5180'
const out = process.argv[3] ?? 'scripts/shots/social'
fs.mkdirSync(out, { recursive: true })

async function account(label) {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await c.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  const username = usernameFor(label)
  await c.from('profiles').insert({ id: data.user.id, email, username })
  return { c, id: data.user.id, session: data.session, username }
}

const [A, B] = await Promise.all([account('host'), account('friend')])
await A.c.from('friends').insert({ user_id: A.id, friend_id: B.id, status: 'pending' })
await B.c.from('friends').update({ status: 'accepted' }).eq('user_id', A.id).eq('friend_id', B.id)
// Some progress for the host: a practice win and a few badges (25 XP each).
await A.c.rpc('record_practice_result', { p_won: true, p_your: 510, p_opp: 320, p_rounds: 9 })
for (const b of ['sharpshooter', 'sharpshooter', 'nil_master', 'trick_king', 'walk_em_down', 'hot_hands'])
  await A.c.from('achievements').insert({ user_id: A.id, badge_name: b, description: b })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
const errors = []
async function open(label, acct) {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(acct.session)])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${label} pageerror: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(`${label}: ${m.text()}`))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${label}: HTTP ${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`))
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: ':root{--safe-t:59px!important;--safe-b:34px!important}' })
  return page
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` })
const ok = (label, cond) => {
  if (!cond) errors.push(`FAIL ${label}`)
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`)
}

const host = await open('host', A)
const friend = await open('friend', B)
await host.waitForTimeout(1500)
await shot(host, '01-home-level')
ok('home shows a level badge', (await host.getByTitle(/^Level \d+$/).count()) > 0)

// Profile: level card, milestones, friends
await host.getByRole('button', { name: 'Profile' }).first().click()
await host.waitForSelector('text=XP to level')
await host.waitForTimeout(900)
await shot(host, '02-profile-level')
await host.getByRole('tab', { name: 'Achievements' }).click()
await host.waitForSelector('text=Milestones')
await host.waitForTimeout(900)
await shot(host, '03-milestones')
ok('milestones show a tier', (await host.getByText('Bronze', { exact: true }).count()) > 0)
await host.keyboard.press('Escape')
await host.waitForTimeout(400)

// Leaderboard: Level board, then friends only
await host.getByRole('button', { name: /Leaderboard/ }).click()
await host.getByRole('tab', { name: 'Level' }).click()
await host.waitForTimeout(1200)
await shot(host, '04-leaderboard-level')
await host.getByRole('tab', { name: 'Friends' }).click()
await host.waitForTimeout(1200)
await shot(host, '05-leaderboard-friends')
ok('friends board lists the friend', (await host.getByText(B.username).count()) > 0)
await host.keyboard.press('Escape')
await host.waitForTimeout(400)

// Host opens a table
await host.getByRole('button', { name: /Play online/ }).click()
await host.getByRole('button', { name: /Create table/ }).click()
await host.waitForSelector('text=Table code', { timeout: 15000 })
const code = (await host.locator('p.font-display.text-6xl').innerText()).trim()
console.log('table', code)

// Friend sees "At table ... Join" in their friends list
await friend.getByRole('button', { name: 'Profile' }).first().click()
await friend.getByRole('tab', { name: 'Friends' }).click()
await friend.waitForSelector(`text=At table ${code}`, { timeout: 15000 }).catch(() => {})
await friend.waitForTimeout(600)
await shot(friend, '06-friend-sees-table')
ok('friend sees the host is at a table', (await friend.getByText(`At table ${code}`).count()) > 0)
await friend.keyboard.press('Escape')
await friend.waitForTimeout(400)

// Host invites the friend from the waiting room
await host.getByRole('button', { name: 'Invite friends' }).click()
await host.waitForSelector(`text=${B.username}`)
await host.getByRole('button', { name: /^Invite$/ }).click()
await host.waitForSelector('text=Invited', { timeout: 8000 }).catch(() => {})
await shot(host, '07-invite-sent')
ok('host sees Invited', (await host.getByText('Invited').count()) > 0)

// Friend gets the pop-up and joins
await friend.waitForSelector(`text=${A.username} invited you`, { timeout: 15000 }).catch(() => {})
await friend.waitForTimeout(700)
await shot(friend, '08-invite-popup')
ok('friend gets the invite pop-up', (await friend.getByText(`${A.username} invited you`).count()) > 0)
await friend.getByRole('button', { name: /^Join$/ }).first().click()
await friend.waitForSelector('text=Table code', { timeout: 15000 }).catch(() => {})
await friend.waitForTimeout(1500)
await shot(friend, '09-friend-joined')
ok('friend lands in the same waiting room', (await friend.locator('p.font-display.text-6xl').innerText().catch(() => '')).trim() === code)
await host.keyboard.press('Escape')
await host.waitForTimeout(2500)
await shot(host, '10-host-sees-friend')

console.log(errors.length ? `\n${errors.length} problems:\n${errors.join('\n')}` : '\nno errors')
await browser.close()
process.exit(errors.some((e) => e.startsWith('FAIL')) ? 1 : 0)
