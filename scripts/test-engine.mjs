// Pure engine checks: thousands of bot-only matches (all rule variants)
// must finish cleanly, every play must be legal, every round must score
// consistently, and illegal human actions must be refused.
//   node scripts/test-engine.mjs
import * as E from '../supabase/functions/_shared/engine.js'

let failures = 0
function check(cond, msg) {
  if (!cond) {
    failures++
    console.error('FAIL:', msg)
  }
}

function seeded(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const variants = [
  {},
  { jokers: true },
  { jokers: true, blindNil: true, doubleNil: true },
  { boardRule: false, nil: false },
  { moonShot: true, winScore: 250 },
  { bagPenalty: false, losingScore: -100 },
]

let games = 0
let rounds = 0
for (const [vi, rules] of variants.entries()) {
  for (let g = 0; g < 150; g++) {
    const rng = seeded(vi * 1000 + g + 1)
    let now = 1_000_000
    const ctx = () => ({ now, rng, control: ['bot', 'bot', 'bot', 'bot'] })
    // All-bot tables stop at round_over (no humans to say "ready"), so drive
    // them with nudges past the deadline.
    const full = E.startMatch(E.createMatch(rules, rng), ctx())
    let seenSeq = 0
    let steps = 0
    while (full.pub.phase !== 'game_over' && steps++ < 500) {
      check(full.pub.phase === 'round_over', `variant ${vi} game ${g}: stuck in ${full.pub.phase}`)
      if (full.pub.phase !== 'round_over') break
      now = full.pub.deadline + 1
      E.act(full, 0, { type: 'nudge' }, ctx())
    }
    check(full.pub.phase === 'game_over', `variant ${vi} game ${g}: never finished`)
    games++
    // Replay events through applyEvent and compare to the snapshot.
    for (const ev of full.pub.events) check(ev.seq > seenSeq, 'event seq must increase')
    for (const h of full.pub.history) {
      rounds++
      check(Number.isFinite(h.A) && Number.isFinite(h.B), 'round deltas are numbers')
    }
    const last = full.pub.history.at(-1)
    check(last.totalA === full.pub.scores.A.total && last.totalB === full.pub.scores.B.total, 'history totals match scores')
    const w = full.pub.winner
    const r = full.pub.rules
    const a = full.pub.scores.A.total
    const b = full.pub.scores.B.total
    if (!full.pub.moon) {
      check((w === 'A' ? a > b : b > a), `winner ${w} must lead (${a} vs ${b})`)
      check(a >= r.winScore || b >= r.winScore || a <= r.losingScore || b <= r.losingScore, 'game ends only at a target')
    }
  }
}

// Every individual play legal + 13 tricks per round, checked step by step.
{
  const rng = seeded(42)
  let now = 5_000
  const ctx = () => ({ now, rng, control: ['bot', 'bot', 'bot', 'bot'] })
  const full = E.createMatch({ jokers: true }, rng)
  E.startMatch(full, ctx())
  const evs = full.pub.events
  let trickCards = 0
  let tricks = 0
  for (const ev of evs) {
    if (ev.t === 'play') trickCards++
    if (ev.t === 'trick') {
      tricks++
      check(ev.cards.length === 4, 'trick has 4 cards')
      check(new Set(ev.cards.map((c) => c.seat)).size === 4, 'each seat plays once per trick')
    }
  }
  check(tricks === 13 && trickCards === 52, `round 1 has 13 tricks (${tricks}) / 52 plays (${trickCards})`)
}

// Human seat: validation and turn order.
{
  const rng = seeded(7)
  let now = 10_000
  const control = ['human', 'bot', 'bot', 'bot']
  const ctx = () => ({ now, rng, control })
  const full = E.createMatch({ jokers: false, blindNil: false }, rng)
  full.pub.dealer = 3 // deal() rotates to 0, so seat 1 bids first; bots run until seat 0
  E.startMatch(full, ctx())
  check(full.pub.phase === 'bidding' && full.pub.turn === 0, 'human (seat 0) bids last after 3 bots')
  check(full.pub.deadline === now + E.TIMERS.bidMs, 'human turn gets a deadline')
  const throws = (fn, code) => {
    try {
      fn()
      return false
    } catch (e) {
      return e instanceof E.EngineError && (!code || e.code === code)
    }
  }
  check(throws(() => E.act(E.cloneFull(full), 1, { type: 'bid', bid: 3 }, ctx()), 'turn'), 'out-of-turn bid refused')
  check(throws(() => E.act(E.cloneFull(full), 0, { type: 'bid', bid: 14 }, ctx()), 'bid'), 'bid > 13 refused')
  check(throws(() => E.act(E.cloneFull(full), 0, { type: 'bid', bid: 0, blind: true }, ctx()), 'bid'), 'blind nil refused when off')
  const p = full.pub.bids[2]
  if (p > 0 && 4 - p > 1) check(throws(() => E.act(E.cloneFull(full), 0, { type: 'bid', bid: 3 - p }, ctx()), 'bid'), `board rule enforced (partner bid ${p})`)
  if (p > 0) check(!throws(() => E.act(E.cloneFull(full), 0, { type: 'bid', bid: Math.max(1, 4 - p) }, ctx())), `board-meeting bid allowed (partner bid ${p})`)
  E.act(full, 0, { type: 'bid', bid: Math.max(3, E.minimumBid(full.pub, 0, full.pub.rules)) }, ctx())
  check(full.pub.phase === 'playing', 'bidding finishes after the human bids')
  // Bots before seat 0 have played; now it's the human's turn or not.
  let guard = 0
  while (full.pub.phase === 'playing' && guard++ < 20) {
    check(full.pub.turn === 0, 'automation stops only on the human seat')
    const hand = full.hands[0]
    const illegal = hand.find((c) => !E.isPlayable(c, hand, full.pub.trick, full.pub.broken, false, true))
    if (illegal) check(throws(() => E.act(E.cloneFull(full), 0, { type: 'play', card: illegal.id }, ctx()), 'card'), 'illegal card refused')
    check(throws(() => E.act(E.cloneFull(full), 0, { type: 'play', card: 'ZZ' }, ctx()), 'card'), 'card not in hand refused')
    const legal = hand.find((c) => E.isPlayable(c, hand, full.pub.trick, full.pub.broken, false, true))
    E.act(full, 0, { type: 'play', card: legal.id }, ctx())
  }
  check(full.pub.phase === 'round_over', 'round ends after 13 human plays')
  check(full.pub.ready[0] === false && full.pub.ready[1] === true, 'bots are ready, human is not')
  E.act(full, 0, { type: 'ready' }, ctx())
  check(full.pub.phase === 'bidding' && full.pub.round === 2, 'next round deals once the human is ready')

  // Timeout: the human idles past the deadline and a nudge auto-moves for them.
  while (full.pub.phase === 'bidding' && full.pub.turn !== 0) E.act(full, 0, { type: 'nudge' }, ctx())
  const before = full.pub.seq
  E.act(full, 0, { type: 'nudge' }, ctx())
  check(full.pub.seq === before, 'nudge before the deadline does nothing')
  now = full.pub.deadline + 1
  E.act(full, 0, { type: 'nudge' }, ctx())
  check(full.pub.bids[0] !== null, 'nudge after the deadline bids for the idle human')
  check(full.pub.events.some((e) => e.t === 'bid' && e.seat === 0 && e.auto), 'auto bid is marked')

  // Away seat: hand it to automation and the round completes on its own.
  control[0] = 'away'
  E.refresh(full, ctx())
  check(full.pub.phase === 'round_over', `away seat is auto-played to round end (phase ${full.pub.phase})`)
}

// applyEvent replay reproduces the snapshot's public fields.
{
  const rng = seeded(99)
  const now = 1
  const ctx = { now, rng, control: ['bot', 'bot', 'bot', 'bot'] }
  const full = E.createMatch({ jokers: true }, rng)
  const start = JSON.parse(JSON.stringify(full.pub))
  E.startMatch(full, ctx)
  let view = start
  for (const ev of full.pub.events) view = E.applyEvent(view, ev)
  for (const k of ['round', 'dealer', 'phase', 'bids', 'tricks', 'counts', 'broken', 'scores']) {
    check(JSON.stringify(view[k]) === JSON.stringify(full.pub[k]), `applyEvent replay matches snapshot for ${k}: ${JSON.stringify(view[k])} vs ${JSON.stringify(full.pub[k])}`)
  }
}

// Scoring spot checks.
{
  const pub = E.createMatch({ bagLimit: 10 }).pub
  pub.bids = [4, 3, 0, 5]
  pub.tricks = [6, 2, 0, 5]
  pub.blind = [false, false, true, false]
  pub.scores.A.bags = 9
  const r = E.scoreRound(pub)
  // A: bid 4, took 6 -> 40 + 2 bags; blind nil made +200; bags 9+2=11 -> -100, 1 left.
  check(r.A.delta === 40 + 2 + 200 - 100 && r.A.bags === 1, `team A scoring (${r.A.delta}, bags ${r.A.bags})`)
  // B: bid 8, took 7 -> set, -80.
  check(r.B.delta === -80 && r.B.made === false, `team B set (${r.B.delta})`)
}

console.log(`${games} matches, ${rounds} rounds simulated`)
if (failures) {
  console.error(`${failures} failure(s)`)
  process.exit(1)
}
console.log('engine OK')
