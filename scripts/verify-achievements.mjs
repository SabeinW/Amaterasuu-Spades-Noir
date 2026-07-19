import { checkNewAchievements, tierForCount, ACHIEVEMENTS } from '../src/data/achievements.js'

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`)
  if (!ok) console.log('  got:', JSON.stringify(actual), '\n  expected:', JSON.stringify(expected))
  if (ok) pass++; else fail++
}

// Walk Em Down fires at exactly 4 consecutive tricks.
{
  const ids = checkNewAchievements('live', { consecutiveTricks: 4 }).map(a => a.id)
  check('walk_em_down fires at 4 in a row', ids.includes('walk_em_down'), true)
}
{
  const ids = checkNewAchievements('live', { consecutiveTricks: 3 }).map(a => a.id)
  check('walk_em_down does NOT fire at 3 in a row', ids.includes('walk_em_down'), false)
}

// Round-scope achievements read the player's own round line.
{
  const ids = checkNewAchievements('round', { bid: 0, taken: 0, blindNil: false }).map(a => a.id)
  check('nil_master fires on a made nil', ids.includes('nil_master'), true)
  check('blind_nil_master does NOT fire on a regular (non-blind) nil', ids.includes('blind_nil_master'), false)
}
{
  const ids = checkNewAchievements('round', { bid: 0, taken: 0, blindNil: true }).map(a => a.id)
  check('blind_nil_master fires on a made blind nil', ids.includes('blind_nil_master'), true)
  check('nil_master does NOT double-fire on a blind nil', ids.includes('nil_master'), false)
}
{
  const ids = checkNewAchievements('round', { bid: 5, taken: 5, blindNil: false }).map(a => a.id)
  check('sharpshooter fires on an exact bid', ids.includes('sharpshooter'), true)
}
{
  const ids = checkNewAchievements('round', { bid: 5, taken: 6, blindNil: false }).map(a => a.id)
  check('sharpshooter does NOT fire when bags are earned', ids.includes('sharpshooter'), false)
}
{
  const ids = checkNewAchievements('round', { bid: 10, taken: 10, blindNil: false }).map(a => a.id)
  check('high_roller fires on a made 10+ bid', ids.includes('high_roller'), true)
}

// Match-scope achievements aren't evaluated against round/live ctx and vice versa.
{
  const ids = checkNewAchievements('match', { consecutiveTricks: 4, won: false, profile: { wins: 0, win_streak: 0, total_games: 0 }, friendCount: 0 }).map(a => a.id)
  check('walk_em_down is scoped to live only, not match', ids.includes('walk_em_down'), false)
}

// Non-repeatable achievements respect the alreadyUnlocked gate; repeatable ones don't.
{
  const already = new Set(['first_win', 'dominant_win'])
  const ids = checkNewAchievements('match', { won: true, profile: { wins: 1, win_streak: 1, total_games: 1 }, marginOfVictory: 400 }, already).map(a => a.id)
  check('non-repeatable first_win is gated once already unlocked', ids.includes('first_win'), false)
  check('repeatable dominant_win re-fires even if already unlocked', ids.includes('dominant_win'), true)
}

// Tier evolution.
check('tier for count 1 is base (null)', tierForCount(1), null)
check('tier for count 2 is gold', tierForCount(2), 'gold')
check('tier for count 3 is diamond', tierForCount(3), 'diamond')
check('tier for count 4 is still diamond', tierForCount(4), 'diamond')
check('tier for count 5 is obsidian', tierForCount(5), 'obsidian')
check('tier for count 7 is prismatic', tierForCount(7), 'prismatic')
check('tier for count 10 is radiant', tierForCount(10), 'radiant')
check('tier for count 14 is celestial', tierForCount(14), 'celestial')
check('tier for count 19 is cosmic', tierForCount(19), 'cosmic')
check('tier for count 50 is still cosmic (ceiling)', tierForCount(50), 'cosmic')

// Every achievement has a valid scope.
const validScopes = new Set(['match', 'round', 'live'])
check('every achievement declares a valid scope', ACHIEVEMENTS.every(a => validScopes.has(a.scope)), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
