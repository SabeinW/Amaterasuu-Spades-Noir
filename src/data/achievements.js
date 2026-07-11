// Achievement catalog. Each entry has a `scope` saying when it's checked,
// since each scope's ctx shape is different (checking a 'round' achievement
// against 'match' ctx, or vice versa, would read undefined fields):
// - 'match': once a match finishes, profile stats already updated —
//   ctx = { won, marginOfVictory, moonShot, profile, friendCount }
// - 'round': after every round completes, mid-match —
//   ctx = { bid, taken, blindNil, bagsEarned }  (this player's own round line)
// - 'live': the instant something happens during play —
//   ctx = { consecutiveTricks }
//
// `repeatable: true` means this can be earned again later — each earn is a
// fresh row in the `achievements` table (see lib/social.js) and the badge's
// tier evolves with the count (2nd earn = gold, 3rd+ = diamond). Entries
// without `repeatable` are milestone/cumulative-stat badges that can only
// ever cross their threshold once, so they stay a one-time unlock.

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
