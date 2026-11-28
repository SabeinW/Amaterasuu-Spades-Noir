// Does the boss brain (Tatsu & Kaida) beat the pro brain (the other three
// couples)? Whole matches, no Nil (how the family plays), switching sides.
//   node scripts/bots/verify-boss.mjs [matches] [jokers]
import * as E from '../../supabase/functions/_shared/engine.js'
import { BOSS, PRO } from '../../supabase/functions/_shared/pro.js'

const MATCHES = Number(process.argv[2] ?? 30)
const JOKERS = process.argv.includes('jokers')
let seed = Number(process.env.SEED ?? 77001)
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}
let bossWins = 0
let bossPts = 0
let proPts = 0
let rounds = 0
let ms = 0
let moves = 0
const timedBoss = {
  bid: (...a) => {
    const t = performance.now()
    const r = BOSS.bid(...a)
    ms += performance.now() - t
    moves++
    return r
  },
  card: (...a) => {
    const t = performance.now()
    const r = BOSS.card(...a)
    ms += performance.now() - t
    moves++
    return r
  },
}
for (let m = 0; m < MATCHES; m++) {
  const bossTeam = m % 2 === 0 ? 'A' : 'B'
  const control = [0, 1, 2, 3].map((s) => (E.teamOf(s) === bossTeam ? 'boss' : 'pro'))
  const full = E.createMatch({ jokers: JOKERS, nil: false, timers: false, winScore: 500 }, rng)
  const ctx = () => ({ now: 0, rng, control, think: true, brains: { pro: PRO, boss: timedBoss } })
  E.startMatch(full, ctx())
  for (let guard = 0; full.pub.phase === 'round_over' && guard < 60; guard++) {
    const r = full.pub.round_result
    rounds++
    bossPts += r[bossTeam].delta
    proPts += r[bossTeam === 'A' ? 'B' : 'A'].delta
    full.pub.deadline = -1
    E.act(full, 0, { type: 'nudge' }, ctx())
  }
  if (full.pub.phase === 'game_over') {
    const r = full.pub.round_result
    rounds++
    bossPts += r[bossTeam].delta
    proPts += r[bossTeam === 'A' ? 'B' : 'A'].delta
  }
  if (full.pub.winner === bossTeam) bossWins++
}
console.log(`${JOKERS ? 'Jokers & Deuces' : 'Standard deck'}, no Nil · ${MATCHES} matches · ${rounds} rounds`)
console.log(`boss won ${bossWins}/${MATCHES} (${Math.round((100 * bossWins) / MATCHES)}%) · points per round: boss ${(bossPts / rounds).toFixed(1)}, pro ${(proPts / rounds).toFixed(1)}`)
console.log(`boss move: avg ${(ms / moves).toFixed(0)} ms`)
