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
    title: 'First Blood',
    description: 'Win your first match',
    icon: '🏆',
    color: '#f5d90a',
    scope: 'match',
    check: (ctx) => ctx.won && ctx.profile.wins >= 1,
  },
  {
    id: 'win_streak_3',
    title: 'On a Roll',
    description: 'Win 3 matches in a row',
    icon: '🔥',
    color: '#f97316',
    scope: 'match',
    check: (ctx) => ctx.profile.win_streak >= 3,
  },
  {
    id: 'win_streak_5',
    title: 'Unstoppable',
    description: 'Win 5 matches in a row',
    icon: '⚡',
    color: '#facc15',
    scope: 'match',
    check: (ctx) => ctx.profile.win_streak >= 5,
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Play 10 matches',
    icon: '🎖️',
    color: '#818cf8',
    scope: 'match',
    check: (ctx) => ctx.profile.total_games >= 10,
  },
  {
    id: 'century_club',
    title: 'Century Club',
    description: 'Play 100 matches',
    icon: '💯',
    color: '#a78bfa',
    scope: 'match',
    check: (ctx) => ctx.profile.total_games >= 100,
  },
  {
    id: 'big_winner',
    title: 'Big Winner',
    description: 'Win 25 matches',
    icon: '👑',
    color: '#fbbf24',
    scope: 'match',
    check: (ctx) => ctx.profile.wins >= 25,
  },
  {
    id: 'social_butterfly',
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
    title: 'Dynasty',
    description: 'Win 10 matches in a row',
    icon: '🏛️',
    color: '#8b5cf6',
    scope: 'match',
    check: (ctx) => ctx.profile.win_streak >= 10,
  },
  {
    id: 'card_shark',
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
  return ACHIEVEMENTS.filter((a) => a.scope === scope && (a.repeatable || !alreadyUnlockedIds.has(a.id)) && a.check(ctx))
}

// 1st earn = base badge, 2nd = gold, 3rd+ = diamond.
export function tierForCount(count) {
  if (count >= 3) return 'diamond'
  if (count >= 2) return 'gold'
  return null
}

export const TIER_STYLE = {
  gold: { label: 'GOLD', ring: '#f5d90a' },
  diamond: { label: 'DIAMOND', ring: '#67e8f9' },
}
