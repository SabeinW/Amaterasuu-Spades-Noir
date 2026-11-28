// Amaterasuu Noir Spades — the one rules engine.
//
// Runs in two places with identical behaviour:
//   - the `game` edge function (online rooms): the server owns the match,
//     validates every move and plays bots/timed-out seats itself, so no
//     player's browser is ever "the host" that everyone else depends on;
//   - the browser (practice games vs AI): the same reducer, run locally.
//
// Everything is keyed by seat number 0..3. Seats 0+2 are team A, 1+3 team B.
// Play goes 0 -> 1 -> 2 -> 3 (clockwise on screen: bottom, left, top, right).
//
// A match is `full = { pub, hands }`. `pub` is safe to show every player
// (it never contains anyone's cards); `hands` stays on the server.
// Every change appends a numbered event to pub.events so clients can animate
// exactly what happened (deal, bid, play, trick, round, game) in order.

export const ENGINE_VERSION = 2
export const SUITS = ['S', 'H', 'D', 'C']
export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' }
const VALUE_RANK = Object.fromEntries(VALUES.map((v, i) => [v, i]))
const MAX_EVENTS = 120

export const TIMERS = { bidMs: 40_000, playMs: 30_000, roundOverMs: 15_000 }

export class EngineError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

export const teamOf = (seat) => (seat % 2 === 0 ? 'A' : 'B')
export const partnerOf = (seat) => (seat + 2) % 4
export const nextSeat = (seat) => (seat + 1) % 4
export const TEAM_SEATS = { A: [0, 2], B: [1, 3] }

// ---------------------------------------------------------------- cards ---

export function buildDeck() {
  const deck = []
  for (const suit of SUITS) for (const value of VALUES) deck.push({ suit, value, id: `${value}${suit}` })
  return deck
}

// Jokers & Deuces: Big Joker, Little Joker, 2♦ and 2♠ top the trump ladder
// (in that order, above the A♠). 2♣ and 2♥ leave the deck so it stays 52.
export function buildDeckJD() {
  const deck = buildDeck().filter((c) => !(c.value === '2' && (c.suit === 'C' || c.suit === 'H')))
  deck.push({ suit: 'JOKER', value: 'BIG', id: 'JOKER_BIG' })
  deck.push({ suit: 'JOKER', value: 'SMALL', id: 'JOKER_SMALL' })
  return deck
}

export function shuffle(deck, rng = Math.random) {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function isTopTrump(card, jd) {
  if (!jd) return false
  if (card.suit === 'JOKER') return true
  return card.value === '2' && (card.suit === 'D' || card.suit === 'S')
}

export function effectiveSuit(card, jd) {
  return isTopTrump(card, jd) ? 'S' : card.suit
}

export function cardRank(card, jd) {
  if (jd) {
    if (card.suit === 'JOKER') return card.value === 'BIG' ? 1006 : 1005
    if (card.suit === 'D' && card.value === '2') return 1004
    if (card.suit === 'S' && card.value === '2') return 1003
  }
  return VALUE_RANK[card.value]
}

// Display order: (jokers) spades, diamonds, clubs, hearts — alternating
// colours. Promoted deuces sit at the front of the spades group.
export function sortHand(cards, jd = false) {
  const suitOrder = { JOKER: -1, S: 0, D: 1, C: 2, H: 3 }
  const group = (c) => (isTopTrump(c, jd) && c.suit !== 'JOKER' ? 'S' : c.suit)
  return [...cards].sort((a, b) => {
    const ga = group(a)
    const gb = group(b)
    if (ga !== gb) return suitOrder[ga] - suitOrder[gb]
    return cardRank(b, jd) - cardRank(a, jd)
  })
}

export function beats(card, best, ledSuit, jd) {
  const cT = effectiveSuit(card, jd) === 'S'
  const bT = effectiveSuit(best, jd) === 'S'
  if (cT && bT) return cardRank(card, jd) > cardRank(best, jd)
  if (cT !== bT) return cT
  if (card.suit === best.suit) return cardRank(card, jd) > cardRank(best, jd)
  return card.suit === ledSuit && best.suit !== ledSuit
}

// Works on [{ seat, card }] (or legacy { pos, card }); returns the winner's key.
export function evaluateTrick(trick, jd = false) {
  let best = trick[0]
  const led = effectiveSuit(trick[0].card, jd)
  for (const entry of trick.slice(1)) if (beats(entry.card, best.card, led, jd)) best = entry
  return best.seat ?? best.pos
}

export function isPlayable(card, hand, trick, spadesBroken, jd = false, spadesBreakRule = true) {
  if (trick.length === 0) {
    const isTrump = effectiveSuit(card, jd) === 'S'
    if (spadesBreakRule && isTrump && !spadesBroken && hand.some((c) => effectiveSuit(c, jd) !== 'S')) return false
    return true
  }
  const led = effectiveSuit(trick[0].card, jd)
  if (hand.some((c) => effectiveSuit(c, jd) === led)) return effectiveSuit(card, jd) === led
  return true
}

// What each seat was dealt in a round, rebuilt from that round's plays. By the
// end of a round every card has been played face up, so this is public then
// (never call it on a round still being played: it returns null until all 52
// cards are down).
export function dealtHands(events, round) {
  let start = -1
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].t === 'deal' && (round === undefined || events[i].round === round)) {
      start = i
      break
    }
  }
  if (start < 0) return null
  const hands = [[], [], [], []]
  for (let i = start + 1; i < events.length; i++) {
    const ev = events[i]
    if (ev.t === 'deal' || ev.t === 'rematch') break
    if (ev.t === 'play') hands[ev.seat].push(ev.card)
  }
  return hands.every((h) => h.length === 13) ? hands : null
}

// The cards people mean by "a good hand": every Ace, plus the Jokers and
// promoted deuces (Jokers & Deuces) or K♠ and Q♠ (a standard deck).
export function isBigCard(card, jd) {
  if (card.value === 'A') return true
  if (jd) return isTopTrump(card, jd)
  return card.suit === 'S' && (card.value === 'K' || card.value === 'Q')
}

// Per seat: how many spades (trumps) and which big cards they were dealt.
export function dealtSummary(hands, jd) {
  return hands.map((h) => ({
    spades: h.filter((c) => effectiveSuit(c, jd) === 'S').length,
    big: sortHand(h.filter((c) => isBigCard(c, jd)), jd).map((c) => c.id),
  }))
}

export function cardLabel(card) {
  if (card.suit === 'JOKER') return card.value === 'BIG' ? 'Big Joker' : 'Little Joker'
  return `${card.value}${SUIT_SYMBOL[card.suit]}`
}

// ---------------------------------------------------------------- rules ---

// Accepts either the DB's flat stringy `rooms.settings` shape or the UI's
// rule names, so callers never have to care which one they hold.
export function normalizeRules(s = {}) {
  const pick = (...keys) => {
    for (const k of keys) if (s[k] !== undefined && s[k] !== null && s[k] !== '') return s[k]
    return undefined
  }
  const bool = (v, d) => (v === undefined ? d : v === true || v === 'true')
  const num = (v, d) => (v === undefined || Number.isNaN(Number(v)) ? d : Number(v))
  return {
    nil: bool(pick('nil', 'standardNil'), true),
    blindNil: bool(pick('blindNil'), false),
    doubleNil: bool(pick('doubleNil'), false),
    jokers: bool(pick('jokers', 'jokersWild'), false),
    bagLimit: Math.max(1, num(pick('bagLimit'), 10)),
    bagPenalty: bool(pick('bagPenalty'), true),
    nilBonus: num(pick('penaltyAmount', 'nilBonus'), 100),
    winScore: Math.max(50, num(pick('winScore'), 500)),
    losingScore: num(pick('losingScore'), -200),
    spadesBreak: bool(pick('spadesBreak', 'spadesBreakRule'), true),
    boardRule: bool(pick('boardRule'), true),
    boardMinimum: Math.min(13, Math.max(0, num(pick('boardMinimum'), 4))),
    moonShot: bool(pick('moonShot'), false),
    timers: bool(pick('timers'), true),
  }
}

// Lowest bid this seat may make right now under the board rule (the
// partnership must bid at least `boardMinimum` together). Nil bids are exempt
// in both directions: a nil bidder has no minimum, and a partner of a nil
// bidder isn't forced to cover the whole board alone.
export function minimumBid(pub, seat, rules) {
  if (!rules.boardRule) return 1
  const p = pub.bids[partnerOf(seat)]
  if (p === null || p === undefined || p === 0) return 1
  return Math.max(1, rules.boardMinimum - p)
}

export function canBidNil(pub, seat, rules) {
  if (!rules.nil) return false
  if (!rules.doubleNil && pub.bids[partnerOf(seat)] === 0) return false
  return true
}

// ------------------------------------------------------------------ bots ---

function sortByStrength(cards, jd) {
  return [...cards].sort((a, b) => cardRank(a, jd) - cardRank(b, jd))
}

function lowestPreferNonTrump(cards, jd) {
  const sorted = sortByStrength(cards, jd)
  return sorted.find((c) => effectiveSuit(c, jd) !== 'S') ?? sorted[0]
}

function winsIfPlayed(card, trick, jd) {
  return evaluateTrick([...trick, { seat: -1, card }], jd) === -1
}

// Expected tricks for a hand, counted the way a player would: sure trump
// winners, guarded side-suit honours, and ruffing chances from short suits.
// Tuned by simulation (scripts/test-engine.mjs) so bot teams make their bid
// ~3 times in 4 and a table's bids add up to about 12.
export const BID_TUNING = { k: 1.3, kJD: 1.2 }
export function trickEstimate(hand, jd) {
  const ladder = sortByStrength((jd ? buildDeckJD() : buildDeck()).filter((c) => effectiveSuit(c, jd) === 'S'), jd).reverse()
  const mine = new Set(hand.map((c) => c.id))
  const trumps = ladder.filter((c) => mine.has(c.id))
  let est = 0
  let higherOut = 0
  let held = 0
  for (const c of ladder) {
    if (!mine.has(c.id)) {
      higherOut++
      continue
    }
    held++
    const below = trumps.length - held
    if (higherOut === 0) est += 1
    else if (higherOut === 1 && below >= 1) est += 0.65
    else if (higherOut === 2 && below >= 2) est += 0.4
  }
  if (trumps.length > 3) est += (trumps.length - 3) * 0.45
  let spareTrumps = Math.max(0, trumps.length - 2)
  for (const suit of ['H', 'D', 'C']) {
    const cards = hand.filter((c) => effectiveSuit(c, jd) === suit)
    const has = (v) => cards.some((c) => c.value === v)
    const n = cards.length
    if (has('A')) est += n <= 5 ? 0.9 : 0.6
    if (has('K') && n >= 2) est += has('A') ? 0.75 : 0.55
    if (has('Q') && n >= 3 && (has('A') || has('K'))) est += 0.25
    if (n === 0 && spareTrumps > 0) {
      est += 0.7
      spareTrumps--
    } else if (n === 1 && spareTrumps > 0) {
      est += 0.35
      spareTrumps--
    }
  }
  return est
}

export function estimateBid(hand, jd) {
  return Math.max(1, Math.min(13, Math.round(trickEstimate(hand, jd) * (jd ? BID_TUNING.kJD : BID_TUNING.k))))
}

export function botBid(hand, seat, pub, rules, rng = Math.random) {
  const jd = rules.jokers
  const trumpCount = hand.filter((c) => effectiveSuit(c, jd) === 'S').length
  const highCards = hand.filter((c) => c.value === 'A' || c.value === 'K' || isTopTrump(c, jd)).length
  const est = trickEstimate(hand, jd)
  if (canBidNil(pub, seat, rules) && trumpCount <= 2 && highCards === 0 && est < 1.2 && rng() < 0.6) return 0
  let bid = estimateBid(hand, jd)
  const p = pub.bids[partnerOf(seat)]
  if (p !== null && p !== undefined && p > 0 && p + bid > 13) bid = Math.max(1, 13 - p)
  return Math.max(bid, minimumBid(pub, seat, rules))
}

export function botCard(hand, seat, pub, rules) {
  return botPlan(hand, seat, pub, rules).card
}

// The bots' card choice plus a short reason code, so the practice coach can
// explain the same move in words (src/lib/coach.js). Reasons:
//   nil-lead, nil-duck, cash-winner, lead-low, partner-nil-cover,
//   partner-winning, opp-nil-duck, take-for-bid, take-to-set, avoid-bags,
//   cant-win, cant-follow-trump, cant-follow-duck
export function botPlan(hand, seat, pub, rules) {
  const jd = rules.jokers
  const legal = hand.filter((c) => isPlayable(c, hand, pub.trick, pub.broken, jd, rules.spadesBreak))
  const sorted = sortByStrength(legal, jd)
  const partner = partnerOf(seat)
  const bid = (s) => pub.bids[s]
  const alive = (s) => bid(s) === 0 && pub.tricks[s] === 0
  const teamBid = [seat, partner].reduce((n, s) => n + (bid(s) || 0), 0)
  const teamTaken = pub.tricks[seat] + pub.tricks[partner]
  const opp = [nextSeat(seat), nextSeat(partner)]
  const oppBid = opp.reduce((n, s) => n + (bid(s) || 0), 0)
  const oppTaken = pub.tricks[opp[0]] + pub.tricks[opp[1]]
  const teamNeeds = teamBid - teamTaken > 0
  const oppNeeds = oppBid - oppTaken > 0
  const plan = (card, why) => ({ card, why })

  if (pub.trick.length === 0) {
    if (alive(seat)) return plan(lowestPreferNonTrump(legal, jd), 'nil-lead')
    if (teamNeeds) {
      const strong = [...sorted].reverse().find((c) => c.value === 'A' || isTopTrump(c, jd))
      if (strong) return plan(strong, 'cash-winner')
    }
    return plan(lowestPreferNonTrump(legal, jd), 'lead-low')
  }

  const losers = sorted.filter((c) => !winsIfPlayed(c, pub.trick, jd))
  const highestLoser = losers[losers.length - 1]
  if (alive(seat)) return plan(highestLoser ?? sorted[0], 'nil-duck')

  const winning = evaluateTrick(pub.trick, jd)
  const cheapestWinner = sorted.find((c) => winsIfPlayed(c, pub.trick, jd))
  const ledHere = hand.some((c) => effectiveSuit(c, jd) === effectiveSuit(pub.trick[0].card, jd))

  if (winning === partner) {
    // Cover a partner whose nil is about to break; otherwise let them have it.
    if (alive(partner)) return plan(cheapestWinner ?? lowestPreferNonTrump(legal, jd), 'partner-nil-cover')
    return plan(lowestPreferNonTrump(losers.length ? losers : legal, jd), 'partner-winning')
  }
  // An opponent's nil is on the line and they're holding the trick: leave it with them.
  if (alive(winning)) return plan(highestLoser ?? sorted[0], 'opp-nil-duck')
  // Take the trick only when it helps (making our bid, or setting theirs);
  // otherwise duck so we don't collect bags.
  if (cheapestWinner && (teamNeeds || oppNeeds)) {
    const ruff = !ledHere && effectiveSuit(cheapestWinner, jd) === 'S'
    return plan(cheapestWinner, ruff ? 'cant-follow-trump' : teamNeeds ? 'take-for-bid' : 'take-to-set')
  }
  const card = lowestPreferNonTrump(losers.length ? losers : legal, jd)
  if (!cheapestWinner) return plan(card, ledHere ? 'cant-win' : 'cant-follow-duck')
  return plan(card, 'avoid-bags')
}

// ----------------------------------------------------------------- match ---

function blank4(v) {
  return [v, v, v, v]
}

export function createMatch(rulesInput, rng = Math.random) {
  const rules = normalizeRules(rulesInput)
  return {
    pub: {
      v: ENGINE_VERSION,
      seq: 0,
      events: [],
      phase: 'waiting',
      round: 0,
      dealer: Math.floor(rng() * 4),
      turn: null,
      deadline: null,
      at: null,
      bids: blank4(null),
      blind: blank4(false),
      tricks: blank4(0),
      counts: blank4(0),
      trick: [],
      led: null,
      broken: false,
      last_trick: null,
      scores: { A: { total: 0, bags: 0 }, B: { total: 0, bags: 0 } },
      round_result: null,
      history: [],
      ready: blank4(false),
      winner: null,
      moon: false,
      rules,
    },
    hands: [[], [], [], []],
  }
}

function emit(pub, ev) {
  pub.seq += 1
  pub.events.push({ ...ev, seq: pub.seq })
  if (pub.events.length > MAX_EVENTS) pub.events.splice(0, pub.events.length - MAX_EVENTS)
}

// ctx = { now, rng, control: ['human'|'bot'|'pro'|'boss'|'away' x4], brains? }
// 'away' is a human who left mid-match: their seat keeps its cards and is
// auto-played immediately (like a bot) until they rejoin.
function isHumanTurn(ctx, seat) {
  return ctx.control[seat] === 'human'
}

function setTurn(full, seat, ctx) {
  const { pub } = full
  pub.turn = seat
  const timed = pub.rules.timers && isHumanTurn(ctx, seat)
  pub.deadline = timed ? ctx.now + (pub.phase === 'bidding' ? TIMERS.bidMs : TIMERS.playMs) : null
}

function deal(full, ctx) {
  const { pub } = full
  const jd = pub.rules.jokers
  const deck = shuffle(jd ? buildDeckJD() : buildDeck(), ctx.rng)
  full.hands = [0, 1, 2, 3].map((s) => sortHand(deck.slice(s * 13, s * 13 + 13), jd))
  pub.round += 1
  pub.dealer = nextSeat(pub.dealer)
  pub.phase = 'bidding'
  pub.bids = blank4(null)
  pub.blind = blank4(false)
  pub.tricks = blank4(0)
  pub.counts = blank4(13)
  pub.trick = []
  pub.led = null
  pub.broken = false
  pub.last_trick = null
  pub.round_result = null
  pub.ready = blank4(false)
  emit(pub, { t: 'deal', round: pub.round, dealer: pub.dealer })
  setTurn(full, nextSeat(pub.dealer), ctx)
}

function applyBid(full, seat, bid, blind, auto, ctx) {
  const { pub } = full
  pub.bids[seat] = bid
  pub.blind[seat] = !!blind
  emit(pub, { t: 'bid', seat, bid, blind: !!blind, auto: !!auto })
  if (pub.bids.every((b) => b !== null)) {
    pub.phase = 'playing'
    setTurn(full, nextSeat(pub.dealer), ctx)
  } else {
    setTurn(full, nextSeat(seat), ctx)
  }
}

function applyPlay(full, seat, card, auto, ctx) {
  const { pub } = full
  const jd = pub.rules.jokers
  full.hands[seat] = full.hands[seat].filter((c) => c.id !== card.id)
  pub.counts[seat] = full.hands[seat].length
  pub.trick.push({ seat, card })
  if (pub.trick.length === 1) pub.led = effectiveSuit(card, jd)
  if (effectiveSuit(card, jd) === 'S') pub.broken = true
  emit(pub, { t: 'play', seat, card, auto: !!auto })
  if (pub.trick.length < 4) {
    setTurn(full, nextSeat(seat), ctx)
    return
  }
  const winner = evaluateTrick(pub.trick, jd)
  pub.tricks[winner] += 1
  pub.last_trick = { cards: pub.trick, winner }
  emit(pub, { t: 'trick', winner, cards: pub.trick })
  pub.trick = []
  pub.led = null
  if (pub.counts.every((n) => n === 0)) endRound(full, ctx)
  else setTurn(full, winner, ctx)
}

export function scoreRound(pub) {
  const r = pub.rules
  const result = { seats: [0, 1, 2, 3].map((s) => ({ bid: pub.bids[s], taken: pub.tricks[s], blind: pub.blind[s] })) }
  for (const team of ['A', 'B']) {
    const seats = TEAM_SEATS[team]
    let delta = 0
    let bid = 0
    let taken = 0
    const nils = []
    for (const s of seats) {
      taken += pub.tricks[s]
      if (pub.bids[s] === 0) {
        const bonus = r.nilBonus * (pub.blind[s] ? 2 : 1)
        const ok = pub.tricks[s] === 0
        delta += ok ? bonus : -bonus
        nils.push({ seat: s, ok, blind: pub.blind[s], points: ok ? bonus : -bonus })
      } else {
        bid += pub.bids[s]
      }
    }
    let made = null
    let bagsEarned = 0
    if (bid > 0) {
      made = taken >= bid
      if (made) {
        bagsEarned = taken - bid
        delta += bid * 10 + bagsEarned
      } else {
        delta -= bid * 10
      }
    } else {
      bagsEarned = taken
      delta += taken
    }
    let bags = pub.scores[team].bags + bagsEarned
    let penalty = 0
    if (r.bagPenalty) {
      while (bags >= r.bagLimit) {
        bags -= r.bagLimit
        penalty += 100
      }
    }
    delta -= penalty
    result[team] = { bid, taken, made, bagsEarned, penalty, nils, delta, total: pub.scores[team].total + delta, bags }
  }
  return result
}

function endRound(full, ctx) {
  const { pub } = full
  const result = scoreRound(pub)
  // What everyone was dealt, so the table can see the luck even out.
  const hands = dealtHands(pub.events, pub.round)
  if (hands) result.dealt = dealtSummary(hands, pub.rules.jokers)
  pub.round_result = result
  pub.scores = { A: { total: result.A.total, bags: result.A.bags }, B: { total: result.B.total, bags: result.B.bags } }
  const luck = result.dealt ? { spades: result.dealt.map((d) => d.spades), big: result.dealt.map((d) => d.big.length) } : {}
  pub.history.push({ round: pub.round, A: result.A.delta, B: result.B.delta, totalA: result.A.total, totalB: result.B.total, ...luck })
  pub.turn = null
  emit(pub, { t: 'round', round: pub.round, result })

  const r = pub.rules
  let winner = null
  if (r.moonShot) {
    if (result.A.taken === 13) winner = 'A'
    else if (result.B.taken === 13) winner = 'B'
    if (winner) pub.moon = true
  }
  const a = result.A.total
  const b = result.B.total
  if (!winner && (a >= r.winScore || b >= r.winScore) && a !== b) winner = a > b ? 'A' : 'B'
  if (!winner && (a <= r.losingScore || b <= r.losingScore) && a !== b) winner = a > b ? 'A' : 'B'

  if (winner) {
    pub.phase = 'game_over'
    pub.winner = winner
    pub.deadline = null
    emit(pub, { t: 'game', winner, moon: pub.moon })
  } else {
    pub.phase = 'round_over'
    pub.ready = [0, 1, 2, 3].map((s) => ctx.control[s] !== 'human')
    pub.deadline = ctx.now + TIMERS.roundOverMs
  }
}

// A 'pro' seat (an AI player with its own account) thinks with the brain
// the caller hands in as ctx.brains.pro, a 'boss' seat with ctx.brains.boss
// (see pro.js); everyone else, and any
// pro move that comes back unusable, uses the quick rules above. Either way
// the brain only ever sees its own hand and the public table.
function autoMove(full, seat, ctx) {
  const { pub } = full
  const hand = full.hands[seat]
  const c = ctx.control[seat]
  // Nobody left at the table to play against: finish quickly (tests that
  // pit the brains against each other pass ctx.think to keep them on).
  const watched = ctx.think || ctx.control.includes('human')
  const brain = !watched ? null : c === 'boss' ? ctx.brains?.boss ?? ctx.brains?.pro : c === 'pro' ? ctx.brains?.pro : null
  if (pub.phase === 'bidding') {
    let bid = brain ? brain.bid(hand, seat, pub, pub.rules, ctx.rng) : null
    const ok = Number.isInteger(bid) && bid >= 0 && bid <= 13 && (bid === 0 ? canBidNil(pub, seat, pub.rules) : bid >= minimumBid(pub, seat, pub.rules))
    if (!ok) bid = botBid(hand, seat, pub, pub.rules, ctx.rng)
    applyBid(full, seat, bid, false, true, ctx)
  } else if (pub.phase === 'playing') {
    let card = brain ? brain.card(hand, seat, pub, pub.rules, ctx.rng) : null
    if (!card || !hand.includes(card) || !isPlayable(card, hand, pub.trick, pub.broken, pub.rules.jokers, pub.rules.spadesBreak)) card = botCard(hand, seat, pub, pub.rules)
    applyPlay(full, seat, card, true, ctx)
  }
}

// Plays every bot / away seat whose turn it is, until a human must act.
function runAutomation(full, ctx) {
  let guard = 0
  while (guard++ < 400) {
    const { pub } = full
    if (pub.phase === 'bidding' || pub.phase === 'playing') {
      if (pub.turn === null || isHumanTurn(ctx, pub.turn)) return
      autoMove(full, pub.turn, ctx)
      continue
    }
    if (pub.phase === 'round_over') {
      const anyHuman = ctx.control.some((c) => c === 'human')
      if (anyHuman && pub.ready.every(Boolean)) {
        deal(full, ctx)
        continue
      }
    }
    return
  }
}

export function startMatch(full, ctx) {
  deal(full, ctx)
  runAutomation(full, ctx)
  full.pub.at = ctx.now
  return full
}

// Applies one action from `seat` (a seated human). Mutates and returns `full`;
// throws EngineError for anything illegal. Callers clone first if they need
// the old state (the edge function always works on a freshly read copy).
export function act(full, seat, action, ctx) {
  const { pub } = full
  const r = pub.rules
  switch (action.type) {
    case 'bid': {
      if (pub.phase !== 'bidding') throw new EngineError('phase', 'Bidding is over.')
      if (pub.turn !== seat) throw new EngineError('turn', "It isn't your turn to bid.")
      const bid = Number(action.bid)
      if (!Number.isInteger(bid) || bid < 0 || bid > 13) throw new EngineError('bid', 'Bids go from Nil to 13.')
      const blind = !!action.blind
      if (blind && (!r.blindNil || bid !== 0)) throw new EngineError('bid', 'Blind Nil is off at this table.')
      if (bid === 0 && !canBidNil(pub, seat, r)) throw new EngineError('bid', r.nil ? 'Double Nil is off at this table.' : 'Nil is off at this table.')
      if (bid > 0 && bid < minimumBid(pub, seat, r)) {
        throw new EngineError('bid', `Your team needs at least ${r.boardMinimum} together — bid ${minimumBid(pub, seat, r)} or more.`)
      }
      applyBid(full, seat, bid, blind, false, ctx)
      break
    }
    case 'play': {
      if (pub.phase !== 'playing') throw new EngineError('phase', "It isn't time to play a card.")
      if (pub.turn !== seat) throw new EngineError('turn', "It isn't your turn.")
      const card = full.hands[seat].find((c) => c.id === action.card)
      if (!card) throw new EngineError('card', "That card isn't in your hand.")
      if (!isPlayable(card, full.hands[seat], pub.trick, pub.broken, r.jokers, r.spadesBreak)) {
        const led = pub.trick.length ? effectiveSuit(pub.trick[0].card, r.jokers) : null
        throw new EngineError('card', led ? `You must follow ${led === 'S' ? 'spades' : { H: 'hearts', D: 'diamonds', C: 'clubs' }[led]}.` : "Spades aren't broken yet.")
      }
      applyPlay(full, seat, card, false, ctx)
      break
    }
    case 'ready': {
      if (pub.phase !== 'round_over') return full
      pub.ready[seat] = true
      break
    }
    case 'nudge': {
      // Anyone may poke a stalled table; it only does something once the
      // current deadline has really passed (judged on the server's clock).
      if (!pub.deadline || ctx.now < pub.deadline) return full
      if (pub.phase === 'bidding' || pub.phase === 'playing') autoMove(full, pub.turn, ctx)
      else if (pub.phase === 'round_over') deal(full, ctx)
      break
    }
    case 'rematch': {
      if (pub.phase !== 'game_over') throw new EngineError('phase', 'The match is still going.')
      const fresh = createMatch(r, ctx.rng)
      fresh.pub.seq = pub.seq
      fresh.pub.events = pub.events
      fresh.pub.dealer = pub.dealer
      full.pub = fresh.pub
      full.hands = fresh.hands
      emit(full.pub, { t: 'rematch' })
      deal(full, ctx)
      break
    }
    default:
      throw new EngineError('action', `Unknown action ${action.type}.`)
  }
  runAutomation(full, ctx)
  full.pub.at = ctx.now
  return full
}

// Re-evaluates automation after seat control changes (someone left, a bot
// took over, a human came back) without any player action.
export function refresh(full, ctx) {
  const { pub } = full
  if ((pub.phase === 'bidding' || pub.phase === 'playing') && pub.turn !== null) {
    if (isHumanTurn(ctx, pub.turn)) {
      if (pub.rules.timers && !pub.deadline) setTurn(full, pub.turn, ctx)
    } else {
      pub.deadline = null
    }
  }
  if (pub.phase === 'round_over') {
    pub.ready = pub.ready.map((rd, s) => rd || ctx.control[s] !== 'human')
  }
  runAutomation(full, ctx)
  pub.at = ctx.now
  return full
}

// Client-side mirror of what each public event does, so a client can step
// through a batch of events one at a time for animation. The authoritative
// snapshot is applied after the batch, so this only has to be close.
export function applyEvent(view, ev) {
  const v = structuredCloneSafe(view)
  const jd = v.rules?.jokers
  switch (ev.t) {
    case 'deal':
      v.round = ev.round
      v.dealer = ev.dealer
      v.phase = 'bidding'
      v.bids = blank4(null)
      v.blind = blank4(false)
      v.tricks = blank4(0)
      v.counts = blank4(13)
      v.trick = []
      v.led = null
      v.broken = false
      v.last_trick = null
      v.round_result = null
      v.winner = null
      v.turn = nextSeat(ev.dealer)
      break
    case 'bid':
      v.bids[ev.seat] = ev.bid
      v.blind[ev.seat] = ev.blind
      if (v.bids.every((b) => b !== null)) {
        v.phase = 'playing'
        v.turn = nextSeat(v.dealer)
      } else v.turn = nextSeat(ev.seat)
      break
    case 'play':
      v.trick = [...v.trick, { seat: ev.seat, card: ev.card }]
      v.counts[ev.seat] = Math.max(0, v.counts[ev.seat] - 1)
      if (v.trick.length === 1) v.led = effectiveSuit(ev.card, jd)
      if (effectiveSuit(ev.card, jd) === 'S') v.broken = true
      v.turn = v.trick.length < 4 ? nextSeat(ev.seat) : null
      break
    case 'trick':
      v.tricks[ev.winner] += 1
      v.last_trick = { cards: ev.cards, winner: ev.winner }
      v.trick = []
      v.led = null
      v.turn = v.counts.some((n) => n > 0) ? ev.winner : null
      break
    case 'round':
      v.round_result = ev.result
      v.scores = { A: { total: ev.result.A.total, bags: ev.result.A.bags }, B: { total: ev.result.B.total, bags: ev.result.B.bags } }
      v.phase = 'round_over'
      v.turn = null
      break
    case 'game':
      v.phase = 'game_over'
      v.winner = ev.winner
      v.moon = ev.moon
      break
    default:
      break
  }
  v.seq = ev.seq
  return v
}

function structuredCloneSafe(o) {
  return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o))
}

export function cloneFull(full) {
  return structuredCloneSafe(full)
}
