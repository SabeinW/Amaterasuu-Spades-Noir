import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

const stamp = Date.now()
const users = [
  { email: `mp-host-${stamp}@gmail.com`, password: 'Test1234!' },
  { email: `mp-guest-${stamp}@gmail.com`, password: 'Test1234!' },
]

const results = []
for (const u of users) {
  const { data, error } = await supabase.auth.signUp(u)
  if (error) throw error
  // Mirrors lib/auth.js signUp() — the app has no DB trigger that
  // provisions a profiles row automatically, so tests need one too.
  await supabase.from('profiles').insert({ id: data.user.id, email: u.email, username: u.email.split('@')[0] })
  results.push({ ...u, id: data.user.id })
}

console.log(JSON.stringify(results, null, 2))
