// Achievement catalog. Each entry's `check(ctx)` is evaluated once a match
// finishes and the player's profile stats have been updated — `ctx.profile`
// already reflects this match, so thresholds compare against post-match
// totals. Unlocking is idempotent (see lib/social.js) so re-checking on
// every match is safe.

export const ACHIEVEMENTS = [
  {
    id: 'first_win',
    title: 'First Blood',
    description: 'Win your first match',
    icon: '🏆',
    color: '#f5d90a',
    check: (ctx) => ctx.won && ctx.profile.wins >= 1,
  },
  {
    id: 'win_streak_3',
    title: 'On a Roll',
    description: 'Win 3 matches in a row',
    icon: '🔥',
    color: '#f97316',
    check: (ctx) => ctx.profile.win_streak >= 3,
  },
  {
    id: 'win_streak_5',
    title: 'Unstoppable',
    description: 'Win 5 matches in a row',
    icon: '⚡',
    color: '#facc15',
    check: (ctx) => ctx.profile.win_streak >= 5,
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Play 10 matches',
    icon: '🎖️',
    color: '#818cf8',
    check: (ctx) => ctx.profile.total_games >= 10,
  },
  {
    id: 'century_club',
    title: 'Century Club',
    description: 'Play 100 matches',
    icon: '💯',
    color: '#a78bfa',
    check: (ctx) => ctx.profile.total_games >= 100,
  },
  {
    id: 'big_winner',
    title: 'Big Winner',
    description: 'Win 25 matches',
    icon: '👑',
    color: '#fbbf24',
    check: (ctx) => ctx.profile.wins >= 25,
  },
  {
    id: 'dominant_win',
    title: 'Dominant',
    description: 'Win a match by 300+ points',
    icon: '💪',
    color: '#22c55e',
    check: (ctx) => ctx.won && ctx.marginOfVictory >= 300,
  },
  {
    id: 'moon_shot',
    title: 'Moon Shot',
    description: 'Win a match by sweeping all 13 tricks in one hand',
    icon: '🌙',
    color: '#38bdf8',
    check: (ctx) => ctx.won && ctx.moonShot,
  },
]

// Returns the subset of ACHIEVEMENTS that ctx newly qualifies for, excluding
// any already in `alreadyUnlockedIds`.
export function checkNewAchievements(ctx, alreadyUnlockedIds = new Set()) {
  return ACHIEVEMENTS.filter((a) => !alreadyUnlockedIds.has(a.id) && a.check(ctx))
}
