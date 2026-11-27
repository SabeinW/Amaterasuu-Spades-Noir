// Forgot-password flow end to end on the LOCAL stack: ask for a reset email
// in the UI, open the link from the email (caught by Mailpit on :54324), set a
// new password, then sign in with it. Also checks your own picture shows in a
// practice game and that card art addresses carry a version (?v=).
//   npx vite preview --host 127.0.0.1 --port 3000   (local auth only redirects there)
//   node scripts/ui-reset-password.mjs [outDir]
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import { KEY, PROD, URL, emailFor, storageKey, usernameFor } from './test-target.mjs'

if (PROD) throw new Error('local only: it reads the reset email from Mailpit')
const base = 'http://127.0.0.1:3000'
const MAILPIT = 'http://127.0.0.1:54324'
const out = process.argv[2] ?? 'scripts/shots/reset'
fs.mkdirSync(out, { recursive: true })
let failed = 0
const ok = (label, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

const email = emailFor('reset')
const c = createClient(URL, KEY, { auth: { persistSession: false } })
const { data: su } = await c.auth.signUp({ email, password: 'old-password-1' })
// an uploaded photo: no default portrait can ever match it
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const avatar = JSON.stringify({ kind: 'photo', url: PHOTO, border: null })
await c.from('profiles').insert({ id: su.user.id, email, username: usernameFor('reset'), avatar_url: avatar })

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome' })
const errors = []
const newPage = async (ctx) => {
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  return page
}

// 1. Ask for the reset email
let ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
let page = await newPage(ctx)
await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /^Sign in$/ }).first().click()
await page.getByRole('button', { name: 'Forgot password?' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/1-forgot.png` })
await page.getByPlaceholder('Email address').fill(email)
await page.getByRole('button', { name: /Email me a reset link/ }).click()
await page.waitForSelector('text=a reset link is on its way', { timeout: 10000 }).catch(() => {})
await page.screenshot({ path: `${out}/2-sent.png` })
ok('the app says the link is on its way', (await page.getByText('a reset link is on its way').count()) > 0)
await ctx.close()

// 2. Find the email in Mailpit
let link = null
for (let i = 0; i < 20 && !link; i++) {
  const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()
  if (list.messages?.length) {
    const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json()
    link = (msg.HTML || msg.Text).match(/https?:\/\/[^"'\s<>]*verify[^"'\s<>]*/)?.[0]?.replace(/&amp;/g, '&')
  }
  if (!link) await new Promise((r) => setTimeout(r, 500))
}
ok('the reset email arrived with a link', !!link)

// 3. Open the link like a fresh tap from the inbox
ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
page = await newPage(ctx)
await page.goto(link, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Choose a new password', { timeout: 10000 }).catch(() => {})
await page.screenshot({ path: `${out}/3-new-password.png` })
ok('the link opens "Choose a new password"', (await page.getByText('Choose a new password').count()) > 0)
await page.getByPlaceholder('New password').fill('new-password-2')
await page.getByPlaceholder('Type it again').fill('new-password-2')
await page.getByRole('button', { name: /Save new password/ }).click()
await page.waitForSelector('text=Password changed', { timeout: 10000 }).catch(() => {})
await page.screenshot({ path: `${out}/4-changed.png` })
ok('the new password saves', (await page.getByText('Password changed').count()) > 0)
await ctx.close()

// 4. The new password works and the old one doesn't
const d = createClient(URL, KEY, { auth: { persistSession: false } })
const { error: newErr } = await d.auth.signInWithPassword({ email, password: 'new-password-2' })
ok('signing in with the new password works', !newErr, newErr?.message)
await d.auth.signOut()
const { error: oldErr } = await d.auth.signInWithPassword({ email, password: 'old-password-1' })
ok('the old password no longer works', !!oldErr)

// 5. Your own picture in a practice game, and versioned art addresses
const { data: si } = await d.auth.signInWithPassword({ email, password: 'new-password-2' })
ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(si.session)])
page = await newPage(ctx)
await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
// the home screen always shows picture cards, so check art addresses here
const artSrcs = await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => s?.includes('/art/court/')))
await page.getByRole('button', { name: /Practice vs AI/ }).click()
await page.waitForTimeout(4000)
const look = page.getByRole('button', { name: /^Look at cards/ })
if (await look.isVisible().catch(() => false)) await look.click()
await page.waitForTimeout(1500)
const myAvatar = await page.locator(`img[src="${PHOTO}"]`).count()
await page.screenshot({ path: `${out}/5-practice.png` })
ok('your own picture shows in a practice game', myAvatar > 0)
const backs = await page.evaluate(() => [...document.querySelectorAll('[style*="/art/backs/"]')].map((e) => e.getAttribute('style').match(/\/art\/backs\/[^)"']+/)?.[0]))
ok('court art addresses carry a version', artSrcs.length > 0 && artSrcs.every((s) => /\?v=[0-9a-f]{8}/.test(s)), JSON.stringify(artSrcs.slice(0, 4)))
ok('card back addresses carry a version', backs.length > 0 && backs.every((s) => /\?v=[0-9a-f]{8}/.test(s)), backs[0])

console.log(errors.length ? `page errors:\n${errors.join('\n')}` : 'no page errors')
await browser.close()
console.log(failed ? `\n${failed} FAILED` : '\nall passed')
process.exit(failed ? 1 : 0)
