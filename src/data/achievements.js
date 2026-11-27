// Achievement catalog. Each entry has a `scope` saying when it's checked,
// since each scope's ctx shape is different (checking a 'round' achievement
// against 'match' ctx, or vice versa, would read undefined fields):
// - 'match': once a match finishes, profile stats already updated —
//   ctx = { won, marginOfVictory, moonShot, profile, friendCount, maxDeficit }
// - 'round': after every round completes, mid-match —
//   ctx = { bid, taken, blindNil, partnerBid, partnerTaken } (this player's
//   own round line, plus their partner's for same-round combo achievements)
// - 'live': the instant something happens during play —
//   ctx = { consecutiveTricks }
//
// `repeatable: true` means this can be earned again later — each earn is a
// fresh row in the `achievements` table (see lib/social.js) and the badge's
// tier evolves with the count (2nd earn = gold, 3rd+ = diamond). Entries
// without `repeatable` are milestone/cumulative-stat badges that can only
// ever cross their threshold once, so they stay a one-time unlock.
//
// The rank-tier achievements (Master through Conqueror) fire the first time
// a match ends with the player's updated elo_rating inside that tier — see
// data/ranks.js for the same thresholds driving the profile rank badge.

import { RANKS } from './ranks.js'

const rankMin = (id) => RANKS.find((r) => r.id === id).min

export const ACHIEVEMENTS = [
  {
    id: 'first_win',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'First Blood',
    description: 'Win your first match',
    icon: '🏆',
    color: '#f5d90a',
    scope: 'match',
    check: (ctx) => ctx.won && ctx.profile.wins >= 1,
  },
  {
    id: 'win_streak_3',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'On a Roll',
    description: 'Win 3 matches in a row',
    icon: '🔥',
    color: '#f97316',
    scope: 'match',
    check: (ctx) => ctx.profile.win_streak >= 3,
  },
  {
    id: 'win_streak_5',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'Unstoppable',
    description: 'Win 5 matches in a row',
    icon: '⚡',
    color: '#facc15',
    scope: 'match',
    check: (ctx) => ctx.profile.win_streak >= 5,
  },
  {
    id: 'veteran',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'Veteran',
    description: 'Play 10 matches',
    icon: '🎖️',
    color: '#818cf8',
    scope: 'match',
    check: (ctx) => ctx.profile.total_games >= 10,
  },
  {
    id: 'century_club',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'Century Club',
    description: 'Play 100 matches',
    icon: '💯',
    color: '#a78bfa',
    scope: 'match',
    check: (ctx) => ctx.profile.total_games >= 100,
  },
  {
    id: 'big_winner',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'Big Winner',
    description: 'Win 25 matches',
    icon: '👑',
    color: '#fbbf24',
    scope: 'match',
    check: (ctx) => ctx.profile.wins >= 25,
  },
  {
    id: 'social_butterfly',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'Social Butterfly',
    description: 'Add 5 friends',
    icon: '🦋',
    color: '#ec4899',
    scope: 'match',
    check: (ctx) => ctx.friendCount >= 5,
  },
  {
    id: 'dominant_win',
    title: 'Dominant',
    description: 'Win a match by 300+ points',
    icon: '💪',
    color: '#22c55e',
    scope: 'match',
    repeatable: true,
    check: (ctx) => ctx.won && ctx.marginOfVictory >= 300,
  },
  {
    id: 'moon_shot',
    title: 'Moon Shot',
    description: 'Win a match by sweeping all 13 tricks in one hand',
    icon: '🌙',
    color: '#38bdf8',
    scope: 'match',
    repeatable: true,
    check: (ctx) => ctx.won && ctx.moonShot,
  },
  {
    id: 'walk_em_down',
    title: 'Walk Em Down',
    description: 'Win 4 tricks in a row',
    icon: '🚶',
    color: '#f97316',
    scope: 'live',
    repeatable: true,
    check: (ctx) => ctx.consecutiveTricks >= 4,
  },
  {
    id: 'run_the_table',
    title: 'Run the Table',
    description: 'Win 7 tricks in a row',
    icon: '🏃',
    color: '#ef4444',
    scope: 'live',
    repeatable: true,
    check: (ctx) => ctx.consecutiveTricks >= 7,
  },
  {
    id: 'hot_hands',
    title: 'Hot Hands',
    description: 'Make your bid 3 hands in a row',
    icon: '🙌',
    color: '#f59e0b',
    scope: 'live',
    repeatable: true,
    check: (ctx) => ctx.madeInRow >= 3,
  },
  {
    id: 'on_fire',
    title: 'On Fire',
    description: 'Make your bid 5 hands in a row',
    icon: '☄️',
    color: '#f43f5e',
    scope: 'live',
    repeatable: true,
    check: (ctx) => ctx.madeInRow >= 5,
  },
  {
    id: 'nil_master',
    title: 'Nil Master',
    description: 'Successfully make a Nil bid',
    icon: '🤫',
    color: '#94a3b8',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.bid === 0 && !ctx.blindNil && ctx.taken === 0,
  },
  {
    id: 'blind_nil_master',
    title: 'Blindfolded',
    description: 'Successfully make a Blind Nil bid',
    icon: '🙈',
    color: '#c084fc',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.bid === 0 && ctx.blindNil && ctx.taken === 0,
  },
  {
    id: 'sharpshooter',
    title: 'Sharpshooter',
    description: 'Hit your bid exactly, no bags',
    icon: '🎯',
    color: '#4ade80',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.bid > 0 && ctx.taken === ctx.bid,
  },
  {
    id: 'high_roller',
    title: 'High Roller',
    description: 'Bid 10 or more tricks and make it',
    icon: '💰',
    color: '#fde68a',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.bid >= 10 && ctx.taken >= ctx.bid,
  },
  {
    id: 'trick_king',
    title: 'Trick King',
    description: 'Take 10 or more tricks in a single hand',
    icon: '👑',
    color: '#fbbf24',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.taken >= 10,
  },
  {
    id: 'sandbag_slayer',
    title: 'Sandbag Slayer',
    description: 'Bid 4 or more and hit it exactly — zero bags',
    icon: '🗡️',
    color: '#64748b',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.bid >= 4 && ctx.taken === ctx.bid,
  },
  {
    id: 'perfect_bid',
    title: 'Perfect Bid',
    description: 'Bid 7 or more and hit it exactly',
    icon: '✅',
    color: '#34d399',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.bid >= 7 && ctx.taken === ctx.bid,
  },
  {
    id: 'ace_collector',
    title: 'Ace Collector',
    description: 'You and your partner both bid and make Nil in the same hand',
    icon: '🂡',
    color: '#f472b6',
    scope: 'round',
    repeatable: true,
    check: (ctx) => ctx.bid === 0 && ctx.taken === 0 && ctx.partnerBid === 0 && ctx.partnerTaken === 0,
  },
  {
    id: 'clutch_player',
    title: 'Clutch Player',
    description: 'Win a match by 20 points or less',
    icon: '😤',
    color: '#f43f5e',
    scope: 'match',
    repeatable: true,
    check: (ctx) => ctx.won && ctx.marginOfVictory > 0 && ctx.marginOfVictory <= 20,
  },
  {
    id: 'comeback_king',
    title: 'Comeback King',
    description: 'Win a match after trailing by 100+ points at some point',
    icon: '🔄',
    color: '#38bdf8',
    scope: 'match',
    repeatable: true,
    check: (ctx) => ctx.won && ctx.maxDeficit >= 100,
  },
  {
    id: 'dynasty',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'Dynasty',
    description: 'Win 10 matches in a row',
    icon: '🏛️',
    color: '#8b5cf6',
    scope: 'match',
    check: (ctx) => ctx.profile.win_streak >= 10,
  },
  {
    id: 'card_shark',
    legacy: true, // replaced by a tiered milestone (MILESTONES below)
    title: 'Card Shark',
    description: 'Win 50 matches',
    icon: '🦈',
    color: '#0ea5e9',
    scope: 'match',
    check: (ctx) => ctx.profile.wins >= 50,
  },
  {
    id: 'rank_master',
    title: 'Master',
    description: 'Reach Master rank',
    icon: '⭐',
    color: '#a78bfa',
    scope: 'match',
    check: (ctx) => ctx.profile.elo_rating >= rankMin('master'),
  },
  {
    id: 'rank_grandmaster',
    title: 'Grandmaster',
    description: 'Reach Grandmaster rank',
    icon: '🌟',
    color: '#f472b6',
    scope: 'match',
    check: (ctx) => ctx.profile.elo_rating >= rankMin('grandmaster'),
  },
  {
    id: 'rank_beast',
    title: 'Beast',
    description: 'Reach Beast rank',
    icon: '🐺',
    color: '#f97316',
    scope: 'match',
    check: (ctx) => ctx.profile.elo_rating >= rankMin('beast'),
  },
  {
    id: 'rank_bloodthirsty',
    title: 'Bloodthirsty',
    description: 'Reach Bloodthirsty rank',
    icon: '🩸',
    color: '#dc2626',
    scope: 'match',
    check: (ctx) => ctx.profile.elo_rating >= rankMin('bloodthirsty'),
  },
  {
    id: 'rank_legend',
    title: 'Legend',
    description: 'Reach Legend rank',
    icon: '🏆',
    color: '#facc15',
    scope: 'match',
    check: (ctx) => ctx.profile.elo_rating >= rankMin('legend'),
  },
  {
    id: 'rank_immortal',
    title: 'Conqueror',
    description: 'Reach Conqueror rank',
    icon: '🔥',
    color: '#fb923c',
    scope: 'match',
    check: (ctx) => ctx.profile.elo_rating >= rankMin('immortal'),
  },
]

// Returns the subset of ACHIEVEMENTS in `scope` that ctx newly qualifies
// for. For non-repeatable entries, anything in `alreadyUnlockedIds` is
// excluded — repeatable ones are always re-checked since earning them again
// is the point (their tier evolves with the repeat count, handled by the
// caller).
export function checkNewAchievements(scope, ctx, alreadyUnlockedIds = new Set()) {
  return ACHIEVEMENTS.filter((a) => !a.legacy && a.scope === scope && (a.repeatable || !alreadyUnlockedIds.has(a.id)) && a.check(ctx))
}

// 1st earn = base badge (no tier), then progressively rarer tiers the more
// times a repeatable achievement is earned again — applies uniformly to
// every repeatable achievement, not configured per-achievement. Diamond used
// to be the ceiling forever after a 3rd earn; thresholds now keep climbing
// well past it (gaps widen with each tier, same escalating-grind feel as
// the rank ladder in data/ranks.js, just paced for how often a single
// achievement can realistically repeat rather than a whole match history).
const TIER_THRESHOLDS = [
  { tier: 'gold', count: 2 },
  { tier: 'diamond', count: 3 },
  { tier: 'obsidian', count: 5 },
  { tier: 'prismatic', count: 7 },
  { tier: 'radiant', count: 10 },
  { tier: 'celestial', count: 14 },
  { tier: 'cosmic', count: 19 },
]

export function tierForCount(count) {
  let tier = null
  for (const t of TIER_THRESHOLDS) {
    if (count >= t.count) tier = t.tier
  }
  return tier
}

export const TIER_STYLE = {
  gold: { label: 'GOLD', ring: '#f5d90a' },
  diamond: { label: 'DIAMOND', ring: '#67e8f9' },
  obsidian: { label: 'OBSIDIAN', ring: '#a78bfa' },
  prismatic: { label: 'PRISMATIC', ring: '#f472b6' },
  radiant: { label: 'RADIANT', ring: '#fb923c' },
  celestial: { label: 'CELESTIAL', ring: '#38bdf8' },
  cosmic: { label: 'COSMIC', ring: '#f8fafc' },
}

// ── Tiered milestones ──────────────────────────────────────────────────────
// Long-term goals that level up through five tiers instead of being separate
// one-off badges. Worked out live from the player's stats (profile, level,
// friends), so they're always accurate and count everything already played.
export const MILESTONE_TIERS = [
  { id: 'bronze', label: 'Bronze', color: '#cd7f32' },
  { id: 'silver', label: 'Silver', color: '#c8ccd4' },
  { id: 'gold', label: 'Gold', color: '#ffd700' },
  { id: 'diamond', label: 'Diamond', color: '#67e8f9' },
  { id: 'legendary', label: 'Legendary', color: '#f472b6' },
]

export const MILESTONES = [
  { id: 'm_wins', title: 'Winner', icon: '👑', unit: 'wins', steps: [1, 10, 25, 50, 100], value: (s) => s.wins },
  { id: 'm_streak', title: 'Hot Streak', icon: '🔥', unit: 'wins in a row', steps: [3, 5, 7, 10, 15], value: (s) => s.bestStreak },
  { id: 'm_games', title: 'Veteran', icon: '🎖️', unit: 'games', steps: [10, 50, 100, 250, 500], value: (s) => s.games },
  { id: 'm_level', title: 'Climber', icon: '⭐', unit: 'level', steps: [5, 10, 25, 50, 75], value: (s) => s.level },
  { id: 'm_friends', title: 'Crew', icon: '🤝', unit: 'friends', steps: [1, 3, 5, 10, 20], value: (s) => s.friends },
]

// stats = { wins, bestStreak, games, level, friends }
export function milestoneStatus(m, stats) {
  const value = Math.max(0, m.value(stats) ?? 0)
  let reached = -1
  m.steps.forEach((step, i) => {
    if (value >= step) reached = i
  })
  const nextStep = m.steps[reached + 1]
  const prevStep = reached >= 0 ? m.steps[reached] : 0
  return {
    value,
    tier: reached >= 0 ? MILESTONE_TIERS[reached] : null,
    next: nextStep != null ? { tier: MILESTONE_TIERS[reached + 1], at: nextStep } : null,
    progress: nextStep != null ? Math.min(1, (value - prevStep) / (nextStep - prevStep)) : 1,
  }
}
