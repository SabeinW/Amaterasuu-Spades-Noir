import { supabase, supabaseEnabled } from './supabase'
import { ACHIEVEMENTS, checkNewAchievements, tierForCount } from '../data/achievements'

// Leaderboard boards: which profile column each one ranks by.
export const BOARDS = {
  rating: { column: 'elo_rating', label: 'Rating' },
  level: { column: 'xp', label: 'Level' },
  wins: { column: 'wins', label: 'Wins' },
  streak: { column: 'best_streak', label: 'Streak' },
}
const BOARD_FIELDS = 'id, username, avatar_url, elo_rating, xp, wins, losses, total_games, best_streak'

// Top players on one board; pass `ids` to rank only those players (friends).
export async function fetchLeaderboard(limit = 20, { board = 'rating', ids = null } = {}) {
  if (!supabaseEnabled) return []
  const { column } = BOARDS[board] ?? BOARDS.rating
  let q = supabase.from('profiles').select(BOARD_FIELDS).order(column, { ascending: false, nullsFirst: false }).limit(limit)
  if (ids) q = q.in('id', ids)
  const { data, error } = await q
  if (error) return []
  return data
}

// Your own row and place on a board (1 + how many players are ahead), so
// you can see where you stand even outside the top list.
export async function fetchMyPlace(userId, { board = 'rating', ids = null } = {}) {
  if (!supabaseEnabled || !userId) return null
  const { column } = BOARDS[board] ?? BOARDS.rating
  const { data: me } = await supabase.from('profiles').select(BOARD_FIELDS).eq('id', userId).maybeSingle()
  if (!me) return null
  let q = supabase.from('profiles').select('id', { count: 'exact', head: true }).gt(column, me[column] ?? 0)
  if (ids) q = q.in('id', ids)
  const { count } = await q
  return { ...me, place: (count ?? 0) + 1 }
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
    ? (await supabase.from('profiles').select('id, username, avatar_url, elo_rating, xp, wins').in('id', otherIds)).data ?? []
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

// Open tables (still in the waiting room) that each friend is sitting at, so
// the friends list can offer "Join". Returns { friendId: roomCode }.
export async function friendsAtTables(friendIds) {
  if (!supabaseEnabled || !friendIds?.length) return {}
  const { data } = await supabase.from('rooms').select('code, players, status').eq('status', 'waiting').limit(100)
  const at = {}
  for (const room of data ?? []) {
    if ((room.players?.length ?? 0) >= 4) continue
    for (const p of room.players ?? []) if (friendIds.includes(p.id)) at[p.id] = room.code
  }
  return at
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

// A repeatable achievement gets a fresh row each time it's earned again (see
// data/achievements.js), so "unlocked" isn't a yes/no — it's a count, which
// is also what drives the gold/diamond tier evolution on repeat earns.
export async function fetchAchievementCounts(userId) {
  if (!supabaseEnabled) return {}
  const { data, error } = await supabase.from('achievements').select('badge_name').eq('user_id', userId)
  if (error || !data) return {}
  const counts = {}
  for (const row of data) counts[row.badge_name] = (counts[row.badge_name] ?? 0) + 1
  return counts
}

// Inserts one row per newly-earned achievement and returns each with the
// tier its NEW count lands on. `counts` is mutated in place so repeated
// calls within the same batch (e.g. several achievements earned on the same
// round) see each other's increments.
async function insertEarnedAchievements(userId, defs, counts) {
  if (!defs.length) return []
  const rows = []
  const results = []
  for (const a of defs) {
    const nextCount = (counts[a.id] ?? 0) + 1
    counts[a.id] = nextCount
    rows.push({ user_id: userId, badge_name: a.id, description: a.title })
    results.push({ ...a, tier: tierForCount(nextCount), count: nextCount })
  }
  const { error } = await supabase.from('achievements').insert(rows)
  if (error) return []
  return results
}

// Evaluates the achievement catalog for one scope ('match' | 'round') against
// the given context, inserts any newly-earned badges, and returns their
// definitions (with tier) so the caller can show an unlock toast.
export async function checkAndUnlockAchievements(userId, scope, ctx) {
  if (!supabaseEnabled || !userId) return []
  const counts = await fetchAchievementCounts(userId)
  const alreadyUnlocked = new Set(Object.keys(counts))
  const newlyEarned = checkNewAchievements(scope, ctx, alreadyUnlocked)
  return insertEarnedAchievements(userId, newlyEarned, counts)
}

// For a 'live' achievement already confirmed true by the caller in real
// time (e.g. a 4-trick win streak the instant it happens) rather than
// re-evaluated from its check() — lets it unlock the moment it happens
// instead of waiting for the match to end.
export async function unlockAchievementNow(userId, achievementId) {
  if (!supabaseEnabled || !userId) return null
  const def = ACHIEVEMENTS.find((a) => a.id === achievementId)
  if (!def) return null
  const counts = await fetchAchievementCounts(userId)
  const [result] = await insertEarnedAchievements(userId, [def], counts)
  return result ?? null
}
