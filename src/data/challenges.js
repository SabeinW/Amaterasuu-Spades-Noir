export const WEEKLY_CHALLENGES = [
  { id: 'hat-trick', title: 'Hat Trick', description: 'Win 3 games this week', target: 3, metric: 'wins', reward: '+50 Rating', icon: '🔥', color: '#f97316' },
  { id: 'clean-hands', title: 'Clean Hands', description: 'Finish a game with 0 bags', target: 1, metric: 'cleanGames', reward: '+30 Rating', icon: '🛡️', color: '#22c55e' },
  { id: 'on-fire', title: 'On Fire', description: 'Achieve a 2-game win streak', target: 2, metric: 'streak', reward: '+40 Rating', icon: '⚡', color: '#f5d90a' },
  { id: 'dedicated', title: 'Dedicated', description: 'Play 5 games this week', target: 5, metric: 'gamesPlayed', reward: '+25 Rating', icon: '🎯', color: '#818cf8' },
]

export const DEFAULT_GAME_RULES = {
  blindNil: true,
  standardNil: true,
  doubleNil: false,
  nilBonus: 100,
  bagPenalty: true,
  bagLimit: 10,
  moonShot: false,
  spadesAlwaysTrump: true,
  spadesBreakRule: true,
  jokersWild: false,
  winScore: 500,
  losingScore: -200,
  partnershipMode: true,
  bidTimer: 'none',
  playTimer: 'none',
}
