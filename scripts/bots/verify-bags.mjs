// Today's fixes (bags' long-run cost, and the natural play unless a move is
// clearly better) vs the brain before them, which
// counted an extra book as +1 and took any move a hair ahead. Whole matches, no Nil,
// switching sides; reports wins, points and bags a hand, and sets.
//   SEED=1 node scripts/bots/verify-bags.mjs [matches] [jokers]
import * as E from '../../supabase/functions/_shared/engine.js'
import { proBid, proCard } from '../../supabase/functions/_shared/pro.js'

const MATCHES = Number(process.argv[2] ?? 6)
const JOKERS = process.argv.includes('jokers')
let seed = Number(process.env.SEED ?? 5)
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}
const OLD = { bid: (...a) => proBid(...a.slice(0, 5), { bagWeight: 0 }), card: (...a) => proCard(...a.slice(0, 5), { bagWeight: 0, margin: -1e9 }) }
const NEW = { bid: (...a) => proBid(...a.slice(0, 5)), card: (...a) => proCard(...a.slice(0, 5)) }

const tally = { new: { wins: 0, pts: 0, bags: 0, over: 0, sets: 0 }, old: { wins: 0, pts: 0, bags: 0, over: 0, sets: 0 } }
let rounds = 0
for (let m = 0; m < MATCHES; m++) {
  const newTeam = m % 2 === 0 ? 'A' : 'B'
  const side = (t) => (t === newTeam ? 'new' : 'old')
  const control = [0, 1, 2, 3].map((s) => (E.teamOf(s) === newTeam ? 'boss' : 'pro'))
  const full = E.createMatch({ jokers: JOKERS, nil: false, timers: false, winScore: 500 }, rng)
  const ctx = () => ({ now: 0, rng, control, think: true, brains: { boss: NEW, pro: OLD } })
  E.startMatch(full, ctx())
  for (let guard = 0; guard < 60 && (full.pub.phase === 'round_over' || full.pub.phase === 'game_over'); guard++) {
    const r = full.pub.round_result
    rounds++
    for (const t of ['A', 'B']) {
      const k = tally[side(t)]
      k.pts += r[t].delta
      k.bags += r[t].bagsEarned
      k.over += r[t].taken - r[t].bid
      if (r[t].made === false) k.sets++
    }
    if (full.pub.phase === 'game_over') break
    full.pub.deadline = -1
    E.act(full, 0, { type: 'nudge' }, ctx())
  }
  if (full.pub.winner) tally[side(full.pub.winner)].wins++
}
for (const [k, v] of Object.entries(tally)) {
  console.log(`${k}: won ${v.wins}/${MATCHES} · ${(v.pts / rounds).toFixed(1)} pts/hand · ${(v.bags / rounds).toFixed(2)} bags/hand · ${(v.over / rounds).toFixed(2)} books over bid · set ${Math.round((100 * v.sets) / rounds)}%`)
}
