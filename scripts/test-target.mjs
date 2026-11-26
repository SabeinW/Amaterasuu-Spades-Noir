// Where the online tests run.
//   default        the LOCAL stack (npx supabase start + functions serve)
//   TARGET=prod    the live project from .env. Test accounts are clearly
//                  marked (qa-…@example.com, usernames qa_…) so they can be
//                  found and removed afterwards; production auto-confirms
//                  sign-ups, so no confirmation email is sent.
import { execSync } from 'node:child_process'
import fs from 'node:fs'

export const PROD = process.env.TARGET === 'prod'

function localEnv() {
  return Object.fromEntries(
    execSync('npx -y supabase@latest status -o env', { encoding: 'utf8' })
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
  )
}

function prodEnv() {
  const env = fs.readFileSync(new globalThis.URL('../.env', import.meta.url), 'utf8')
  return { API_URL: env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim(), ANON_KEY: env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim() }
}

const env = PROD ? prodEnv() : localEnv()
export const URL = env.API_URL
export const KEY = env.ANON_KEY

const tag = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
export const emailFor = (label) => (PROD ? `qa-${label}-${tag()}@example.com` : `${label}-${tag()}@test.local`)
export const usernameFor = (label) => (PROD ? `qa_${label}${tag().slice(-5)}` : `${label}${Math.floor(Math.random() * 1e5)}`)
// supabase-js keeps the browser session under sb-<project ref>-auth-token
export const storageKey = `sb-${PROD ? new globalThis.URL(URL).hostname.split('.')[0] : '127'}-auth-token`
