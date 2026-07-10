import { supabase, supabaseEnabled } from './supabase'
import { checkNewAchievements } from '../data/achievements'

export async function fetchLeaderboard(limit = 20) {
  if (!supabaseEnabled) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, elo_rating, wins, losses, total_games')
    .order('elo_rating', { ascending: false })
    .limit(limit)
  if (error) return []
  return data
}

export async function searchProfiles(query, excludeUserId) {
  if (!supabaseEnabled || !query.trim()) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, elo_rating')
    .ilike('username', `%${query.trim()}%`)
    .neq('id', excludeUserId)
    .limit(10)
  if (error) return []
  return data
}

// Friendship is modeled as a single row per pair; direction only matters for
// "who requested" — acceptance/friendship itself is treated symmetrically by
// checking both user_id and friend_id in every query below.
export async function listFriends(userId) {
  if (!supabaseEnabled) return { friends: [], incoming: [], outgoing: [] }
  const { data, error } = await supabase
    .from('friends')
    .select('id, user_id, friend_id, status')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
  if (error || !data) return { friends: [], incoming: [], outgoing: [] }

  const otherIds = data.map((r) => (r.user_id === userId ? r.friend_id : r.user_id))
  const profiles = otherIds.length
    ? (await supabase.from('profiles').select('id, username, avatar_url, elo_rating').in('id', otherIds)).data ?? []
    : []
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const friends = []
  const incoming = []
  const outgoing = []
  for (const row of data) {
    const otherId = row.user_id === userId ? row.friend_id : row.user_id
    const profile = profileById[otherId]
    if (!profile) continue
    if (row.status === 'accepted') friends.push({ rowId: row.id, ...profile })
    else if (row.status === 'pending' && row.friend_id === userId) incoming.push({ rowId: row.id, ...profile })
    else if (row.status === 'pending' && row.user_id === userId) outgoing.push({ rowId: row.id, ...profile })
  }
  return { friends, incoming, outgoing }
}

export async function sendFriendRequest(userId, friendId) {
  if (!supabaseEnabled) return
  const { data: existing } = await supabase
    .from('friends')
    .select('id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
    .maybeSingle()
  if (existing) return
  const { error } = await supabase.from('friends').insert({ user_id: userId, friend_id: friendId, status: 'pending' })
  if (error) throw error
}

export async function respondToFriendRequest(rowId, accept) {
  if (!supabaseEnabled) return
  if (accept) {
    const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', rowId)
    if (error) throw error
  } else {
    const { error } = await supabase.from('friends').delete().eq('id', rowId)
    if (error) throw error
  }
}

export async function removeFriend(rowId) {
  if (!supabaseEnabled) return
  const { error } = await supabase.from('friends').delete().eq('id', rowId)
  if (error) throw error
}

export async function fetchUnlockedAchievementIds(userId) {
  if (!supabaseEnabled) return new Set()
  const { data, error } = await supabase.from('achievements').select('badge_name').eq('user_id', userId)
  if (error || !data) return new Set()
  return new Set(data.map((r) => r.badge_name))
}

// Evaluates the achievement catalog against the just-finished match + the
// player's freshly-updated profile, inserts any newly-earned badges, and
// returns their definitions (so the caller can show an unlock toast).
export async function checkAndUnlockAchievements(userId, matchCtx) {
  if (!supabaseEnabled || !userId) return []
  const alreadyUnlocked = await fetchUnlockedAchievementIds(userId)
  const newlyUnlocked = checkNewAchievements(matchCtx, alreadyUnlocked)
  if (!newlyUnlocked.length) return []
  await supabase.from('achievements').insert(
    newlyUnlocked.map((a) => ({ user_id: userId, badge_name: a.id, description: a.title }))
  )
  return newlyUnlocked
}
