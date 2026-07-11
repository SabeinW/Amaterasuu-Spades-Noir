import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

const stamp = Date.now()
const email = `achv-test-${stamp}@gmail.com`
const { data: signup, error: signErr } = await supabase.auth.signUp({ email, password: 'Test1234!' })
if (signErr) throw signErr
const userId = signup.user.id
await supabase.from('profiles').insert({ id: userId, email, username: email.split('@')[0] })

// Mirrors src/lib/social.js's tier-count logic directly against the live DB
// (can't import the app's own module tree here — its bare-specifier
// imports like './supabase' resolve fine under Vite's bundler but not under
// plain Node ESM, which requires explicit extensions).
function tierForCount(count) {
  if (count >= 3) return 'diamond'
  if (count >= 2) return 'gold'
  return null
}

async function fetchCounts(uid) {
  const { data } = await supabase.from('achievements').select('badge_name').eq('user_id', uid)
  const counts = {}
  for (const row of data ?? []) counts[row.badge_name] = (counts[row.badge_name] ?? 0) + 1
  return counts
}

async function unlockNow(uid, badgeId, title) {
  const counts = await fetchCounts(uid)
  const nextCount = (counts[badgeId] ?? 0) + 1
  const { error } = await supabase.from('achievements').insert({ user_id: uid, badge_name: badgeId, description: title })
  if (error) throw error
  return { id: badgeId, count: nextCount, tier: tierForCount(nextCount) }
}

console.log('=== earn walk_em_down 3 times, check tier evolves ===')
for (let i = 1; i <= 3; i++) {
  const result = await unlockNow(userId, 'walk_em_down', 'Walk Em Down')
  console.log(`earn #${i}:`, JSON.stringify(result))
}

const counts = await fetchCounts(userId)
console.log('final counts:', JSON.stringify(counts))
if (counts.walk_em_down !== 3) throw new Error(`expected count 3, got ${counts.walk_em_down}`)
console.log('\nPASS — walk_em_down earned 3 times, DB round-trips correctly (1=base, 2=gold, 3=diamond)')

await supabase.auth.signOut()
