// The "pro" brain: how the AI players with their own accounts (Big Dre,
// Keisha and the rest) bid and play. Plain table bots use the quick rules in
// engine.js; this one thinks harder, the way a strong player does:
//
//   1. Work out what it can know: its own hand, every card already played
//      this round, who has shown out of a suit, and what everyone bid.
//   2. Imagine many deals of the unseen cards that fit all of that, leaning
//      towards deals that match the bids (a 5-bidder probably holds spades,
//      a Nil bidder probably doesn't hold Aces).
//   3. Play each choice out to the end of the round in every imagined deal
//      and keep the one that scores best on average, bags and set risk
//      included, with an eye on whether the game ends this round.
//
// They never bid Nil (the family doesn't play it): with a weak hand they
// bid what the board needs, like everyone at the table does.
//
// It never looks at anyone else's cards: it only ever gets its own hand and
// the public table (pub), the same as a person sitting there.
import {
  BID_TUNING,
  botBid,
  botPlan,
  buildDeck,
  buildDeckJD,
  cardRank,
  estimateBid,
  effectiveSuit,
  evaluateTrick,
  isPlayable,
  minimumBid,
  nextSeat,
  partnerOf,
  scoreRound,
  teamOf,
  trickEstimate,
} from './engine.js'

const NON_TRUMP = ['H', 'D', 'C']
const PLAY_MS = 110
const BID_MS = 140
const MAX_PLAY_SAMPLES = 90
const MAX_BID_SAMPLES = 60
const MIN_SAMPLES = 10
const GAME_SWING = 250

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function shuffled(arr, rng) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ----------------------------------------------------------- what's known ---

// Every card played this round per seat, and the suits each seat has shown
// out of, read from the public event log.
export function roundKnowledge(pub) {
  const jd = pub.rules.jokers
  const played = [[], [], [], []]
  const voids = [new Set(), new Set(), new Set(), new Set()]
  let start = -1
  for (let i = pub.events.length - 1; i >= 0; i--) {
    const ev = pub.events[i]
    if (ev.t === 'deal' && ev.round === pub.round) {
      start = i
      break
    }
  }
  let trick = []
  let broken = false
  for (let i = start + 1; start >= 0 && i < pub.events.length; i++) {
    const ev = pub.events[i]
    if (ev.t === 'play') {
      const suit = effectiveSuit(ev.card, jd)
      if (trick.length) {
        const led = effectiveSuit(trick[0].card, jd)
        if (suit !== led) voids[ev.seat].add(led)
      } else if (suit === 'S' && !broken && pub.rules.spadesBreak) {
        // Led a spade before spades broke: they had nothing else.
        for (const s of NON_TRUMP) voids[ev.seat].add(s)
      }
      if (suit === 'S') broken = true
      played[ev.seat].push(ev.card)
      trick.push(ev)
    } else if (ev.t === 'trick') {
      trick = []
    }
  }
  return { played, voids }
}

// Deal `unknown` to `seats` so each gets counts[seat] cards and nobody gets
// a suit they've shown out of. Most-constrained cards go first; a dead end
// starts over, and after enough tries the void rule is relaxed.
function deal(unknown, seats, counts, voids, jd, rng) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const relax = attempt >= 30
    const hands = {}
    const room = {}
    for (const s of seats) {
      hands[s] = []
      room[s] = counts[s]
    }
    const cards = shuffled(unknown, rng).map((c) => {
      const suit = effectiveSuit(c, jd)
      return { c, elig: relax ? seats : seats.filter((s) => !voids[s].has(suit)) }
    })
    cards.sort((a, b) => a.elig.length - b.elig.length)
    let ok = true
    for (const { c, elig } of cards) {
      const open = elig.filter((s) => room[s] > 0)
      if (!open.length) {
        ok = false
        break
      }
      let r = rng() * open.reduce((n, s) => n + room[s], 0)
      let pick = open[open.length - 1]
      for (const s of open) {
        r -= room[s]
        if (r < 0) {
          pick = s
          break
        }
      }
      hands[pick].push(c)
      room[pick]--
    }
    if (ok) return hands
  }
  return null
}

// How believable a seat's bid is for the hand we imagined for it. People
// don't bid exactly like the formula, so the curve is wide; a bid we can't
// read anything from (Blind Nil, or no bid yet) counts the same for any hand.
function bidLikelihood(bid, blind, hand, jd) {
  if (bid === null || bid === undefined || blind) return 1
  const est = trickEstimate(hand, jd) * (jd ? BID_TUNING.kJD : BID_TUNING.k)
  if (bid === 0) return est <= 1.6 ? 1 : Math.max(0.03, Math.exp(-((est - 1.6) ** 2) / 1.2))
  return Math.max(0.03, Math.exp(-((bid - est) ** 2) / (2 * 1.7 * 1.7)))
}

// --------------------------------------------------------------- playing ---

// Plays the rest of the round with every seat using the quick bot rules on
// the hand it holds in this imagined deal. Mutates its arguments.
function playOut(hands, s, rules) {
  const jd = rules.jokers
  for (let guard = 0; guard < 60; guard++) {
    if (s.trick.length === 4) {
      const w = evaluateTrick(s.trick, jd)
      s.tricks[w] += 1
      s.trick = []
      s.turn = w
      if (hands[w].length === 0) return
    }
    const hand = hands[s.turn]
    if (!hand.length) return
    const card = botPlan(hand, s.turn, s, rules).card
    hands[s.turn] = hand.filter((c) => c !== card)
    s.trick.push({ seat: s.turn, card })
    if (effectiveSuit(card, jd) === 'S') s.broken = true
    s.turn = nextSeat(s.turn)
  }
}

// How good a finished round is for `seat`'s team: our points minus theirs,
// bag penalties included, plus a big swing if it settles the game.
// Bags left on the books cost later: every bagLimit of them is -100. So
// beyond the point a bag scores now, each one still on the books is counted
// at about -(100 / limit) x BAG_WEIGHT (a penalty paid this hand is already
// in delta and clears them). Without this, extra books looked nearly free,
// and the bots bid low and grabbed everything (bid 4, took 10).
export const BAG_WEIGHT = 0.7
const bagDebt = (bags, r, w) => (r.bagPenalty ? (bags * 100 * w) / r.bagLimit : 0)

function value(pub, tricks, bids, blind, seat, bagW = BAG_WEIGHT) {
  const r = pub.rules
  const res = scoreRound({ rules: r, bids, blind, tricks, scores: pub.scores })
  const us = teamOf(seat)
  const them = us === 'A' ? 'B' : 'A'
  let v = res[us].delta - res[them].delta
  v -= bagDebt(res[us].bags, r, bagW) - bagDebt(pub.scores[us].bags, r, bagW)
  v += bagDebt(res[them].bags, r, bagW) - bagDebt(pub.scores[them].bags, r, bagW)
  const a = res[us].total
  const b = res[them].total
  if ((a >= r.winScore || b >= r.winScore || a <= r.losingScore || b <= r.losingScore) && a !== b) v += a > b ? GAME_SWING : -GAME_SWING
  return v
}

// Two of our cards in one suit play the same when no live card (unseen, or
// on the table right now) sits between them; keep only the lowest of each run.
function distinctChoices(legal, unknown, onTable, jd) {
  if (legal.length <= 1) return legal
  const mine = new Set(legal.map((c) => c.id))
  const bySuit = {}
  for (const c of [...legal, ...unknown, ...onTable]) (bySuit[effectiveSuit(c, jd)] ??= []).push(c)
  const keep = []
  for (const cards of Object.values(bySuit)) {
    cards.sort((x, y) => cardRank(x, jd) - cardRank(y, jd))
    let prevMine = false
    for (const c of cards) {
      const isMine = mine.has(c.id)
      if (isMine && !prevMine) keep.push(c)
      prevMine = isMine
    }
  }
  return keep.length ? keep : legal
}

export function proCard(hand, seat, pub, rules, rng = Math.random, opts = {}) {
  const jd = rules.jokers
  const legal = hand.filter((c) => isPlayable(c, hand, pub.trick, pub.broken, jd, rules.spadesBreak))
  if (legal.length <= 1) return legal[0] ?? hand[0]
  try {
    const { played, voids } = roundKnowledge(pub)
    const seen = new Set([...hand, ...played.flat()].map((c) => c.id))
    const unknown = (jd ? buildDeckJD() : buildDeck()).filter((c) => !seen.has(c.id))
    const others = [0, 1, 2, 3].filter((s) => s !== seat)
    const choices = distinctChoices(legal, unknown, pub.trick.map((t) => t.card), jd)
    if (choices.length === 1) return choices[0]
    const totals = choices.map(() => 0)
    let weightSum = 0
    const stop = now() + (opts.ms ?? PLAY_MS)
    for (let n = 0; n < (opts.samples ?? MAX_PLAY_SAMPLES); n++) {
      if (n >= MIN_SAMPLES && now() > stop) break
      const dealt = deal(unknown, others, pub.counts, voids, jd, rng)
      if (!dealt) break
      let w = 1
      for (const s of others) w *= bidLikelihood(pub.bids[s], pub.blind[s], [...dealt[s], ...played[s]], jd)
      weightSum += w
      choices.forEach((card, i) => {
        const hands = [0, 1, 2, 3].map((s) => (s === seat ? hand.filter((c) => c !== card) : [...dealt[s]]))
        const s = { trick: [...pub.trick, { seat, card }], broken: pub.broken || effectiveSuit(card, jd) === 'S', bids: pub.bids, tricks: [...pub.tricks], turn: nextSeat(seat) }
        playOut(hands, s, rules)
        totals[i] += w * value(pub, s.tricks, pub.bids, pub.blind, seat, opts.bagWeight)
      })
    }
    if (!weightSum) return botPlan(hand, seat, pub, rules).card
    let best = 0
    for (let i = 1; i < choices.length; i++) if (totals[i] > totals[best]) best = i
    return choices[best]
  } catch {
    return botPlan(hand, seat, pub, rules).card
  }
}

// --------------------------------------------------------------- bidding ---

export function proBid(hand, seat, pub, rules, rng = Math.random, opts = {}) {
  const jd = rules.jokers
  try {
    const floor = minimumBid(pub, seat, rules)
    const p = pub.bids[partnerOf(seat)]
    const cap = p !== null && p !== undefined && p > 0 ? Math.max(floor, 13 - p) : 13
    const base = estimateBid(hand, jd)
    const candidates = []
    for (let b = Math.max(floor, base - 2); b <= Math.min(cap, base + 2); b++) candidates.push(b)
    if (!candidates.length) candidates.push(Math.min(13, Math.max(floor, base)))
    if (candidates.length === 1) return candidates[0]

    const mine = new Set(hand.map((c) => c.id))
    const unknown = (jd ? buildDeckJD() : buildDeck()).filter((c) => !mine.has(c.id))
    const others = [0, 1, 2, 3].filter((s) => s !== seat)
    const counts = [13, 13, 13, 13]
    const noVoids = [new Set(), new Set(), new Set(), new Set()]
    const leader = nextSeat(pub.dealer)
    // Seats still to bid after us, in order.
    const later = []
    for (let s = nextSeat(seat); s !== leader; s = nextSeat(s)) later.push(s)

    const totals = candidates.map(() => 0)
    let weightSum = 0
    const stop = now() + (opts.ms ?? BID_MS)
    for (let n = 0; n < (opts.samples ?? MAX_BID_SAMPLES); n++) {
      if (n >= MIN_SAMPLES && now() > stop) break
      const dealt = deal(unknown, others, counts, noVoids, jd, rng)
      if (!dealt) break
      let w = 1
      for (const s of others) w *= bidLikelihood(pub.bids[s], pub.blind[s], dealt[s], jd)
      weightSum += w
      candidates.forEach((bid, i) => {
        const bids = [...pub.bids]
        bids[seat] = bid
        const sim = { ...pub, bids }
        for (const s of later) bids[s] = botBid(dealt[s], s, sim, rules, rng)
        const hands = [0, 1, 2, 3].map((s) => (s === seat ? [...hand] : [...dealt[s]]))
        const s = { trick: [], broken: false, bids, tricks: [0, 0, 0, 0], turn: leader }
        playOut(hands, s, rules)
        totals[i] += w * value(pub, s.tricks, bids, pub.blind, seat, opts.bagWeight)
      })
    }
    if (!weightSum) return botBid(hand, seat, pub, rules, rng)
    let best = 0
    for (let i = 1; i < candidates.length; i++) if (totals[i] > totals[best]) best = i
    return candidates[best]
  } catch {
    return botBid(hand, seat, pub, rules, rng)
  }
}

export const PRO = { bid: proBid, card: proCard }

// The boss couple (Tatsu & Kaida) think about two and a half times as hard:
// more imagined deals per decision, so fewer lucky guesses.
export const BOSS = {
  bid: (hand, seat, pub, rules, rng) => proBid(hand, seat, pub, rules, rng, { ms: 320, samples: 160 }),
  card: (hand, seat, pub, rules, rng) => proCard(hand, seat, pub, rules, rng, { ms: 260, samples: 240 }),
}
