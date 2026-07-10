import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env', 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()

// Two independent clients simulating two different signed-in users.
const clientA = createClient(url, key)
const clientB = createClient(url, key)

const stamp = Date.now()
async function makeUser(client, tag) {
  const email = `social-${tag}-${stamp}@gmail.com`
  const { data, error } = await client.auth.signUp({ email, password: 'Test1234!' })
  if (error) throw error
  await client.from('profiles').insert({ id: data.user.id, email, username: `${tag}${stamp}` })
  return data.user.id
}

const userA = await makeUser(clientA, 'alice')
const userB = await makeUser(clientB, 'bob')
console.log('userA:', userA)
console.log('userB:', userB)

// --- friend request flow ---
const { error: reqErr } = await clientA.from('friends').insert({ user_id: userA, friend_id: userB, status: 'pending' })
console.log('A sends friend request to B:', reqErr ? `ERROR ${reqErr.message}` : 'OK')

const { data: bIncoming, error: bIncomingErr } = await clientB.from('friends').select('*').eq('friend_id', userB).eq('status', 'pending')
console.log('B sees incoming request:', bIncomingErr ? `ERROR ${bIncomingErr.message}` : `OK (${bIncoming.length} row)`)

const reqRowId = bIncoming[0].id
const { error: acceptErr } = await clientB.from('friends').update({ status: 'accepted' }).eq('id', reqRowId)
console.log('B accepts:', acceptErr ? `ERROR ${acceptErr.message}` : 'OK')

const { data: aFriends } = await clientA.from('friends').select('*').or(`user_id.eq.${userA},friend_id.eq.${userA}`).eq('status', 'accepted')
console.log('A now sees accepted friendship:', aFriends.length === 1 ? 'OK' : `FAIL (${aFriends.length})`)

// --- recordMatchResult simulation (mirrors lib/auth.js logic) ---
async function recordMatch(client, userId, won) {
  await client.from('match_history').insert({ user_id: userId, won, your_score: won ? 500 : 300, opponent_score: won ? 300 : 500, rounds: 6 })
  const { data: profile } = await client.from('profiles').select('*').eq('id', userId).single()
  const winStreak = won ? (profile.win_streak ?? 0) + 1 : 0
  const { data: updated, error } = await client
    .from('profiles')
    .update({
      games_played: (profile.games_played ?? 0) + 1,
      total_games: (profile.total_games ?? 0) + 1,
      wins: (profile.wins ?? 0) + (won ? 1 : 0),
      losses: (profile.losses ?? 0) + (won ? 0 : 1),
      win_streak: winStreak,
      best_streak: Math.max(profile.best_streak ?? 0, winStreak),
      rating: (profile.rating ?? 1000) + (won ? 15 : -10),
      elo_rating: (profile.elo_rating ?? 1200) + (won ? 15 : -10),
    })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return updated
}

const afterWin1 = await recordMatch(clientA, userA, true)
console.log('after 1st win — wins:', afterWin1.wins, 'win_streak:', afterWin1.win_streak, 'elo:', afterWin1.elo_rating)
await recordMatch(clientA, userA, true)
const afterWin3 = await recordMatch(clientA, userA, true)
console.log('after 3rd consecutive win — win_streak:', afterWin3.win_streak, '(expect 3)')

// --- achievement unlock simulation (mirrors data/achievements.js + lib/social.js) ---
const { checkNewAchievements } = await import('../src/data/achievements.js')
const ctx = { won: true, marginOfVictory: afterWin3.rating ? 200 : 0, moonShot: false, profile: afterWin3 }
const newly = checkNewAchievements(ctx, new Set())
console.log('newly qualifying achievements after 3 wins:', newly.map((a) => a.id))
console.assert(newly.some((a) => a.id === 'first_win'), 'should unlock first_win')
console.assert(newly.some((a) => a.id === 'win_streak_3'), 'should unlock win_streak_3')

const { error: unlockErr } = await clientA.from('achievements').insert(newly.map((a) => ({ user_id: userA, badge_name: a.id, description: a.title })))
console.log('insert unlocked achievements:', unlockErr ? `ERROR ${unlockErr.message}` : 'OK')

const { data: achRows } = await clientA.from('achievements').select('badge_name').eq('user_id', userA)
console.log('A achievement rows in DB:', achRows.map((r) => r.badge_name))

// re-checking with the now-unlocked set should yield nothing new for the same thresholds
const already = new Set(achRows.map((r) => r.badge_name))
const reCheck = checkNewAchievements(ctx, already)
console.log('re-check with already-unlocked set (expect empty):', reCheck.map((a) => a.id))
console.assert(reCheck.length === 0, 'idempotency check failed — would insert duplicates')

// --- leaderboard query ---
const { data: leaderboard, error: lbErr } = await clientA
  .from('profiles')
  .select('id, username, avatar_url, elo_rating, wins, losses, total_games')
  .order('elo_rating', { ascending: false })
  .limit(5)
console.log('leaderboard query:', lbErr ? `ERROR ${lbErr.message}` : `OK top row: ${leaderboard[0]?.username} @ ${leaderboard[0]?.elo_rating}`)

// --- avatar/username update ---
const { serializeAvatar } = await import('../src/data/avatars.js')
const { data: avatarUpdated, error: avatarErr } = await clientA
  .from('profiles')
  .update({ avatar_url: serializeAvatar({ emoji: '🦄', color: '#ec4899' }), username: `alice_renamed_${stamp}` })
  .eq('id', userA)
  .select()
  .single()
console.log('avatar+username update:', avatarErr ? `ERROR ${avatarErr.message}` : `OK (${avatarUpdated.username}, ${avatarUpdated.avatar_url})`)

console.log('\nAll social/achievement logic checks completed.')
