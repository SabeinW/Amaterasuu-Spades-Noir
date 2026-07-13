export const SUITS = ['S', 'H', 'D', 'C']
export const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const POSITIONS = ['bottom', 'left', 'top', 'right']
export const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' }
export const SUIT_COLOR = { S: 'dark', H: 'red', D: 'blue', C: 'green' }

const VALUE_RANK = Object.fromEntries(VALUES.map((v, i) => [v, i]))

export function buildDeck() {
  const deck = []
  for (const suit of SUITS) {
    for (const value of VALUES) {
      deck.push({ suit, value, id: `${value}${suit}` })
    }
  }
  return deck
}

// Jokers & Deuces variant: Big Joker, Little Joker, 2♦, and 2♠ are pulled out
// of the normal suits to form the top of the trump ladder (in that order),
// ranking above every other card including the Ace of Spades. The 2♣ and 2♥
// are dropped entirely so the deck stays at 52 cards (13 per player) — only
// 2♦ and 2♠ survive, promoted into the trump suit alongside the jokers.
export function buildDeckJD() {
  const deck = buildDeck().filter((c) => !(c.value === '2' && (c.suit === 'C' || c.suit === 'H')))
  deck.push({ suit: 'JOKER', value: 'BIG', id: 'JOKER_BIG' })
  deck.push({ suit: 'JOKER', value: 'SMALL', id: 'JOKER_SMALL' })
  return deck
}

export function shuffle(deck) {
  const arr = [...deck]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Suit-group order is Spades, Diamonds, Clubs, Hearts. In Jokers & Deuces
// mode, 2♠ and 2♦ are promoted trumps (see isTopTrump) — they're pulled out
// of their printed suit and grouped into the Spades section instead so the
// hand LOOKS like what it actually plays like, with jokers (if any, already
// their own 'JOKER' suit) leading the whole hand and the deuces leading the
// spades group ahead of the Ace. Without `useJD`, deuces have no special
// status and sort in their normal printed suit.
export function sortHand(cards, useJD = false) {
  const suitOrder = { S: 0, D: 1, C: 2, H: 3, JOKER: -1 }
  const isDeuceTrump = (c) => useJD && c.value === '2' && (c.suit === 'S' || c.suit === 'D')
  return [...cards].sort((a, b) => {
    const aDeuce = isDeuceTrump(a)
    const bDeuce = isDeuceTrump(b)
    const aGroup = aDeuce ? 'S' : a.suit
    const bGroup = bDeuce ? 'S' : b.suit
    if (aGroup !== bGroup) return suitOrder[aGroup] - suitOrder[bGroup]
    if (aGroup === 'S') {
      if (aDeuce !== bDeuce) return aDeuce ? -1 : 1
      if (aDeuce && bDeuce) return a.suit === 'S' ? -1 : 1
      return VALUE_RANK[b.value] - VALUE_RANK[a.value]
    }
    return VALUE_RANK[a.value] - VALUE_RANK[b.value]
  })
}

export function dealHands(useJD = false) {
  const deck = shuffle(useJD ? buildDeckJD() : buildDeck())
  const perPlayer = deck.length / 4
  const hands = {}
  POSITIONS.forEach((pos, i) => {
    hands[pos] = sortHand(deck.slice(i * perPlayer, (i + 1) * perPlayer), useJD)
  })
  return hands
}

// True for any card that has been promoted into the trump ladder: the two
// jokers, 2♦, and 2♠. In JD mode these always play as trump regardless of
// what was led, exactly like a regular spade.
export function isTopTrump(card, useJD) {
  if (!useJD) return false
  if (card.suit === 'JOKER') return true
  return card.value === '2' && (card.suit === 'D' || card.suit === 'S')
}

// The suit a card effectively belongs to for follow-suit/trump purposes.
// Top-trump cards (jokers, 2♦, 2♠) count as spades even though 2♦ is
// printed as a diamond.
export function effectiveSuit(card, useJD) {
  if (isTopTrump(card, useJD)) return 'S'
  return card.suit
}

function cardRank(card, useJD) {
  if (useJD) {
    if (card.suit === 'JOKER') return card.value === 'BIG' ? 1006 : 1005
    if (card.suit === 'D' && card.value === '2') return 1004
    if (card.suit === 'S' && card.value === '2') return 1003
  }
  return VALUE_RANK[card.value]
}

export function beats(card, winnerCard, ledSuit, useJD = false) {
  const cardTrump = effectiveSuit(card, useJD) === 'S'
  const winnerTrump = effectiveSuit(winnerCard, useJD) === 'S'
  if (cardTrump && winnerTrump) return cardRank(card, useJD) > cardRank(winnerCard, useJD)
  if (cardTrump && !winnerTrump) return true
  if (!cardTrump && winnerTrump) return false
  if (card.suit === winnerCard.suit) return cardRank(card, useJD) > cardRank(winnerCard, useJD)
  if (card.suit === ledSuit && winnerCard.suit !== ledSuit) return true
  return false
}

export function evaluateTrick(trick, useJD = false) {
  let winner = trick[0]
  const ledSuit = effectiveSuit(trick[0].card, useJD)
  for (const entry of trick.slice(1)) {
    if (beats(entry.card, winner.card, ledSuit, useJD)) winner = entry
  }
  return winner.pos
}

export function isPlayable(card, hand, currentTrick, spadesBroken, useJD = false, spadesBreakRule = true) {
  if (currentTrick.length === 0) {
    if (spadesBreakRule && effectiveSuit(card, useJD) === 'S' && !spadesBroken && hand.some((c) => effectiveSuit(c, useJD) !== 'S')) return false
    return true
  }
  const ledSuit = effectiveSuit(currentTrick[0].card, useJD)
  const hasLedSuit = hand.some((c) => effectiveSuit(c, useJD) === ledSuit)
  if (hasLedSuit) return effectiveSuit(card, useJD) === ledSuit
  return true
}

function scoreIndividual(pos, bids, tricks, bags, baseNilBonus, bagLimit, blindNilFlags) {
  const bid = bids[pos] ?? 0
  const taken = tricks[pos] ?? 0
  let score = 0
  let bagsEarned = 0
  if (bid === 0) {
    const nilBonus = blindNilFlags[pos] ? baseNilBonus * 2 : baseNilBonus
    score = taken === 0 ? nilBonus : -nilBonus
  } else if (taken >= bid) {
    bagsEarned = taken - bid
    score = bid * 10 + bagsEarned
  } else {
    score = -bid * 10
  }
  let newBags = (bags[pos] ?? 0) + bagsEarned
  let penalty = 0
  while (newBags >= bagLimit) {
    newBags -= bagLimit
    penalty += 100
  }
  return { bid, taken, bagsEarned, penaltyThisRound: penalty, score: score - penalty, bags: newBags }
}

// Partnership scoring: a team's numeric bid is its two bids summed (nil
// contributes 0, since it's scored separately below), and is checked against
// the team's COMBINED tricks taken — not each partner's own tricks. This is
// what makes one partner's extra tricks cover the other's shortfall instead
// of scoring as an unrelated personal failure, and only tricks left over
// after the combined bid is met count as bags — never a partner's own
// under-bid on its own.
function scoreTeam(posA, posB, bids, tricks, bags, baseNilBonus, bagLimit, blindNilFlags) {
  let teamScore = 0
  let nonNilBidTotal = 0
  let combinedTricks = 0
  for (const pos of [posA, posB]) {
    const bid = bids[pos] ?? 0
    const taken = tricks[pos] ?? 0
    combinedTricks += taken
    if (bid === 0) {
      const nilBonus = blindNilFlags[pos] ? baseNilBonus * 2 : baseNilBonus
      teamScore += taken === 0 ? nilBonus : -nilBonus
    } else {
      nonNilBidTotal += bid
    }
  }
  let teamBagsEarned = 0
  if (nonNilBidTotal > 0) {
    if (combinedTricks >= nonNilBidTotal) {
      teamBagsEarned = combinedTricks - nonNilBidTotal
      teamScore += nonNilBidTotal * 10 + teamBagsEarned
    } else {
      teamScore -= nonNilBidTotal * 10
    }
  }
  // Bags are a shared team pool, not per-seat — read from either partner's
  // running total since both are kept in sync round to round.
  let newBags = (bags[posA] ?? bags[posB] ?? 0) + teamBagsEarned
  let penalty = 0
  while (newBags >= bagLimit) {
    newBags -= bagLimit
    penalty += 100
  }
  const finalScore = teamScore - penalty
  const perSeat = {}
  for (const pos of [posA, posB]) {
    perSeat[pos] = { bid: bids[pos] ?? 0, taken: tricks[pos] ?? 0, bagsEarned: teamBagsEarned, penaltyThisRound: penalty, score: finalScore, bags: newBags }
  }
  return perSeat
}

export function scoreRound(bids, tricks, bags, settings = {}, blindNilFlags = {}) {
  const baseNilBonus = settings.nilBonus ?? 100
  const bagLimit = settings.bagLimit ?? 10
  if (settings.partnershipMode === false) {
    const result = {}
    for (const pos of POSITIONS) {
      result[pos] = scoreIndividual(pos, bids, tricks, bags, baseNilBonus, bagLimit, blindNilFlags)
    }
    return result
  }
  return {
    ...scoreTeam('bottom', 'top', bids, tricks, bags, baseNilBonus, bagLimit, blindNilFlags),
    ...scoreTeam('left', 'right', bids, tricks, bags, baseNilBonus, bagLimit, blindNilFlags),
  }
}

// No hard cap against the other seats' bids — real Spades lets the table's
// four bids land over or under 13 combined (that mismatch is what makes a
// round swingy: a team can blow way past their bid, or leave tricks on the
// table). Weights below are tuned (see scripts/verify scripts) so an average
// hand estimates around 3 on its own, which keeps bots from being reckless
// without artificially forcing every round to sum to exactly 13.
export function estimateBotBid(hand, nilEnabled = true, useJD = false) {
  const trumpCount = hand.filter((c) => effectiveSuit(c, useJD) === 'S').length
  const topTrumpCount = hand.filter((c) => isTopTrump(c, useJD)).length
  const highCards = hand.filter((c) => VALUE_RANK[c.value] >= VALUE_RANK['A'] || (effectiveSuit(c, useJD) === 'S' && VALUE_RANK[c.value] >= VALUE_RANK['J'])).length
  const nonTrump = hand.length - trumpCount
  let estimate = Math.round(trumpCount * 0.6 + topTrumpCount * 0.4 + highCards * 0.22 + nonTrump * 0.09)
  let bid = Math.max(1, Math.min(9, estimate))
  if (nilEnabled && trumpCount <= 1 && highCards === 0 && Math.random() < 0.35) {
    bid = 0
  }
  return bid
}

// Partnership mapping: seat 0/2 (bottom/top) are one team, 1/3 (left/right)
// the other — matches the fixed data-position layout used throughout.
export function posTeam(pos) {
  return pos === 'bottom' || pos === 'top' ? 'A' : 'B'
}

// The cheapest card in `sorted` (ascending) that would win the trick if
// played now, or null if nothing in hand can beat the current best card.
function cheapestWinner(sorted, currentTrick, useJD) {
  for (const card of sorted) {
    const would = [...currentTrick, { pos: '_me', card }]
    if (evaluateTrick(would, useJD) === '_me') return card
  }
  return null
}

// `context` carries what a bot needs to play with real trick awareness:
// - pos: this bot's own seat, to know its team and its own bid progress
// - bids / tricksTaken: this round's bids and tricks-won-so-far per seat
// Without context (or on a fresh/incomplete one) this degrades gracefully
// to "lead low, otherwise play the cheapest legal card" — never throws.
export function botCardChoice(hand, currentTrick, spadesBroken, ledSuit, useJD = false, spadesBreakRule = true, context = {}) {
  const { pos, bids = {}, tricksTaken = {} } = context
  const playable = hand.filter((c) => isPlayable(c, hand, currentTrick, spadesBroken, useJD, spadesBreakRule))

  if (currentTrick.length === 0) {
    const nonTrump = playable.filter((c) => effectiveSuit(c, useJD) !== 'S')
    const pool = nonTrump.length ? nonTrump : playable
    const sorted = sortHand(pool)
    // Still short of our own bid? Lead a near-certain winner (an Ace, or a
    // top trump) to actively bank a trick instead of always leading low.
    const myBid = bids[pos] ?? 0
    const myTaken = tricksTaken[pos] ?? 0
    if (myBid > 0 && myTaken < myBid) {
      const strongLead = [...sorted].reverse().find((c) => c.value === 'A' || isTopTrump(c, useJD))
      if (strongLead) return strongLead
    }
    return sorted[0]
  }

  const canFollow = playable.some((c) => (ledSuit ? effectiveSuit(c, useJD) === ledSuit : true))
  const followers = canFollow ? playable.filter((c) => effectiveSuit(c, useJD) === ledSuit) : playable
  const sorted = sortHand(followers)

  const currentWinnerPos = evaluateTrick(currentTrick, useJD)
  const winnerIsTeammate = pos && posTeam(currentWinnerPos) === posTeam(pos) && currentWinnerPos !== pos
  // If our own partner bid nil and is currently sitting on the trick, they
  // need rescuing — otherwise it's someone we shouldn't bother competing with.
  const partnerNilInDanger = winnerIsTeammate && bids[currentWinnerPos] === 0

  if (winnerIsTeammate && !partnerNilInDanger) {
    // Our own team already has this trick — don't burn a high card (or a
    // trump, if we're void in the led suit) contesting our own partner.
    const nonTrumpFollowers = sorted.filter((c) => effectiveSuit(c, useJD) !== 'S')
    return (nonTrumpFollowers.length ? nonTrumpFollowers : sorted)[0]
  }

  // An opponent holds the trick, or our nil-bidding partner needs saving —
  // take it with the cheapest card that gets the job done.
  const winner = cheapestWinner(sorted, currentTrick, useJD)
  return winner ?? sorted[0]
}

export function cardLabel(card) {
  if (card.suit === 'JOKER') return card.value === 'BIG' ? 'Big Joker' : 'Small Joker'
  return `${card.value}${SUIT_SYMBOL[card.suit]}`
}
