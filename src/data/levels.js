// Player levels, from `profiles.xp` (earned on the server: see the
// apply_match_result migration). A win is ~150 XP online (100 + 5 per round),
// a loss ~90, practice half that, and each achievement 25.
//
// Going from level L to L+1 costs 100 + 40·(L−1) XP, so early levels come
// every game or two and later ones take a real run of play: level 10 is
// about 16 online wins, level 50 a few hundred. Capped at 100.

export const MAX_LEVEL = 100

const stepCost = (level) => 100 + 40 * (level - 1)

// Total XP needed to reach `level` (level 1 = 0).
export function xpForLevel(level) {
  const l = Math.min(Math.max(1, level), MAX_LEVEL)
  return 100 * (l - 1) + 20 * (l - 1) * (l - 2)
}

export function levelForXp(xp = 0) {
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  return level
}

// Where a player sits inside their level, for the XP bar.
export function levelProgress(xp = 0) {
  const level = levelForXp(xp)
  if (level >= MAX_LEVEL) return { level, title: titleForLevel(level), into: 0, needed: 0, progress: 1 }
  const start = xpForLevel(level)
  const needed = stepCost(level)
  return { level, title: titleForLevel(level), into: xp - start, needed, progress: Math.min(1, (xp - start) / needed) }
}

// A new title every few levels.
const TITLES = [
  { min: 1, title: 'Rookie' },
  { min: 5, title: 'Card Slinger' },
  { min: 10, title: 'Table Regular' },
  { min: 15, title: 'Bid Caller' },
  { min: 20, title: 'Spade Runner' },
  { min: 30, title: 'Trick Taker' },
  { min: 40, title: 'High Roller' },
  { min: 50, title: 'Big Joker' },
  { min: 60, title: 'Card Shark' },
  { min: 75, title: 'Table Royalty' },
  { min: 90, title: 'Living Legend' },
  { min: 100, title: 'Sun Sovereign' },
]

export function titleForLevel(level) {
  let t = TITLES[0].title
  for (const x of TITLES) if (level >= x.min) t = x.title
  return t
}

// The colour of the level badge climbs with the level.
export function levelColor(level) {
  if (level >= 90) return '#f8fafc'
  if (level >= 75) return '#c084fc'
  if (level >= 50) return '#f97316'
  if (level >= 30) return '#67e8f9'
  if (level >= 15) return '#ffd700'
  if (level >= 5) return '#c0c0c0'
  return '#cd7f32'
}
