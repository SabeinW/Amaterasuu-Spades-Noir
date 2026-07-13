// Rank ladder, driven entirely by the existing `profiles.elo_rating` column
// (starts at 1200, ±15/-10 per match — see recordMatchResult in lib/auth.js)
// so no schema change is needed. Thresholds ramp up non-linearly: the first
// few tiers are a handful of wins apart so early progress feels immediate,
// while the top tiers demand a long, sustained win rate — Apex is meant to
// be a rare, aspirational badge, not something a single good session reaches.
export const RANKS = [
  { id: 'bronze', label: 'Bronze', min: 0, color: '#cd7f32', icon: '🥉' },
  { id: 'silver', label: 'Silver', min: 1250, color: '#c0c0c0', icon: '🥈' },
  { id: 'gold', label: 'Gold', min: 1350, color: '#ffd700', icon: '🥇' },
  { id: 'platinum', label: 'Platinum', min: 1500, color: '#5eead4', icon: '💠' },
  { id: 'emerald', label: 'Emerald', min: 1700, color: '#10b981', icon: '💚' },
  { id: 'sapphire', label: 'Sapphire', min: 1900, color: '#2563eb', icon: '💙' },
  { id: 'ruby', label: 'Ruby', min: 2150, color: '#e11d48', icon: '❤️' },
  { id: 'diamond', label: 'Diamond', min: 2400, color: '#67e8f9', icon: '💎' },
  { id: 'master', label: 'Master', min: 2700, color: '#a78bfa', icon: '⭐' },
  { id: 'grandmaster', label: 'Grandmaster', min: 3000, color: '#f472b6', icon: '🌟' },
  { id: 'beast', label: 'Beast', min: 3350, color: '#f97316', icon: '🐺' },
  { id: 'bloodthirsty', label: 'Bloodthirsty', min: 3700, color: '#dc2626', icon: '🩸' },
  { id: 'legend', label: 'Legend', min: 4100, color: '#facc15', icon: '🏆' },
  { id: 'immortal', label: 'Conqueror', min: 4500, color: '#fb923c', icon: '🔥' },
  { id: 'mythic', label: 'Mythic', min: 5000, color: '#c084fc', icon: '🔮' },
  { id: 'titan', label: 'Titan', min: 5600, color: '#94a3b8', icon: '⚡' },
  { id: 'apex', label: 'Apex', min: 6300, color: '#f8fafc', icon: '👑' },
]

export function rankForRating(rating = 1200) {
  let current = RANKS[0]
  for (const r of RANKS) {
    if (rating >= r.min) current = r
    else break
  }
  return current
}

export function rankIndex(rankId) {
  return RANKS.findIndex((r) => r.id === rankId)
}

// Progress (0-1) from the current rank's threshold toward the next one, plus
// the point gap remaining — used to draw a progress bar under the badge.
export function rankProgress(rating = 1200) {
  const current = rankForRating(rating)
  const idx = rankIndex(current.id)
  const next = RANKS[idx + 1]
  if (!next) return { current, next: null, progress: 1, pointsToNext: 0 }
  const span = next.min - current.min
  const progress = Math.max(0, Math.min(1, (rating - current.min) / span))
  return { current, next, progress, pointsToNext: Math.max(0, next.min - rating) }
}
