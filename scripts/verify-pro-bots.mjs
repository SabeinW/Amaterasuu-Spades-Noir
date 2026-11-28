// How much better the account bots' "pro" brain plays than the plain bots.
// Plays whole matches, pro team vs plain team (switching sides each match),
// and reports wins, points per round, sets, and how long a pro move takes.
//   node scripts/verify-pro-bots.mjs [matches] [jokers] [nonil]
import * as E from '../supabase/functions/_shared/engine.js'
import { PRO, proBid, proCard } from '../supabase/functions/_shared/pro.js'

const MATCHES = Number(process.argv[2] ?? 40)
const JOKERS = process.argv.includes('jokers')
const NIL = !process.argv.includes('nonil')

let seed = 20261128
const rng = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 2 ** 32
}

// Time each pro decision.
const times = { bid: [], card: [] }
const timed = {
  bid: (...a) => {
    const t = performance.now()
    const r = proBid(...a)
    times.bid.push(performance.now() - t)
    return r
  },
  card: (...a) => {
    const t = performance.now()
    const r = proCard(...a)
    times.card.push(performance.now() - t)
    return r
  },
}

let proWins = 0
let proPts = 0
let plainPts = 0
let rounds = 0
let proSet = 0
let plainSet = 0
let proNils = 0
let proNilsMade = 0
for (let m = 0; m < MATCHES; m++) {
  const proTeam = m % 2 === 0 ? 'A' : 'B'
  const control = [0, 1, 2, 3].map((s) => (E.teamOf(s) === proTeam ? 'pro' : 'bot'))
  const full = E.createMatch({ jokers: JOKERS, nil: NIL, timers: false, winScore: 500 }, rng)
  const ctx = () => ({ now: 0, rng, control, brains: { pro: timed } })
  E.startMatch(full, ctx())
  let guard = 0
  while (full.pub.phase !== 'game_over' && guard++ < 60) {
    if (full.pub.phase === 'round_over') {
      const r = full.pub.round_result
      const other = proTeam === 'A' ? 'B' : 'A'
      rounds++
      proPts += r[proTeam].delta
      plainPts += r[other].delta
      if (r[proTeam].made === false) proSet++
      if (r[other].made === false) plainSet++
      for (const n of r[proTeam].nils) {
        proNils++
        if (n.ok) proNilsMade++
      }
      // Bots are always ready; a human-less table deals itself, so nudge.
      full.pub.deadline = -1
      E.act(full, 0, { type: 'nudge' }, ctx())
    } else break
  }
  if (full.pub.winner === proTeam) proWins++
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const p95 = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)] : 0)
console.log(`${JOKERS ? 'Jokers & Deuces' : 'Standard deck'}${NIL ? '' : ', no Nil'} · ${MATCHES} matches · ${rounds} rounds`)
console.log(`pro team won ${proWins}/${MATCHES} matches (${Math.round((100 * proWins) / MATCHES)}%)`)
console.log(`points per round: pro ${(proPts / rounds).toFixed(1)}, plain ${(plainPts / rounds).toFixed(1)}`)
console.log(`set: pro ${Math.round((100 * proSet) / rounds)}% of rounds, plain ${Math.round((100 * plainSet) / rounds)}%`)
console.log(`pro nils: ${proNilsMade}/${proNils} made`)
console.log(`pro bid: avg ${avg(times.bid).toFixed(0)} ms, p95 ${p95(times.bid).toFixed(0)} ms · pro card: avg ${avg(times.card).toFixed(0)} ms, p95 ${p95(times.card).toFixed(0)} ms`)
if (PRO.bid !== proBid) process.exit(1)
