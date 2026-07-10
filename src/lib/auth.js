import { supabase, supabaseEnabled } from './supabase'

export async function signUp(email, password) {
  if (!supabaseEnabled) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  const user = data.user
  if (user) {
    // No DB trigger provisions `profiles` on signup in this project — the
    // client is expected to insert its own row, matching the existing
    // "Users can create their own profile when they sign up." RLS policy.
    await supabase.from('profiles').insert({ id: user.id, email, username: email.split('@')[0] })
  }
  return data
}

export async function signIn(email, password) {
  if (!supabaseEnabled) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabaseEnabled) return
  await supabase.auth.signOut()
}

export async function getSession() {
  if (!supabaseEnabled) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback) {
  if (!supabaseEnabled) return { data: { subscription: { unsubscribe() {} } } }
  return supabase.auth.onAuthStateChange((_event, session) => callback(session))
}

export async function fetchProfile(userId) {
  if (!supabaseEnabled) return null
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) return null
  return data
}

export async function updateProfile(userId, patch) {
  if (!supabaseEnabled) return null
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single()
  if (error) throw error
  return data
}

// Records the match, updates cumulative profile stats, and returns the
// updated profile row so the caller (e.g. an achievement check) doesn't need
// a second round-trip to see the post-match totals.
export async function recordMatchResult(userId, { won, yourScore, opponentScore, rounds }) {
  if (!supabaseEnabled) return null
  await supabase.from('match_history').insert({ user_id: userId, won, your_score: yourScore, opponent_score: opponentScore, rounds })

  const profile = await fetchProfile(userId)
  if (!profile) return null
  const winStreak = won ? (profile.win_streak ?? 0) + 1 : 0
  const { data, error } = await supabase
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
  if (error) return null
  return data
}
