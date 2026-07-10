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

export function sortHand(cards) {
  const suitOrder = { S: 0, H: 1, D: 2, C: 3, JOKER: -1 }
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit]
    return VALUE_RANK[a.value] - VALUE_RANK[b.value]
  })
}

export function dealHands(useJD = false) {
  const deck = shuffle(useJD ? buildDeckJD() : buildDeck())
  const perPlayer = deck.length / 4
  const hands = {}
  POSITIONS.forEach((pos, i) => {
    hands[pos] = sortHand(deck.slice(i * perPlayer, (i + 1) * perPlayer))
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

export function scoreRound(bids, tricks, bags, settings = {}, blindNilFlags = {}) {
  const baseNilBonus = settings.nilBonus ?? 100
  const bagLimit = settings.bagLimit ?? 10
  const result = {}
  for (const pos of POSITIONS) {
    const bid = bids[pos] ?? 0
    const taken = tricks[pos] ?? 0
    let score = 0
    let bagsEarned = 0
    if (bid === 0) {
      const nilBonus = blindNilFlags[pos] ? baseNilBonus * 2 : baseNilBonus
      score = taken === 0 ? nilBonus : -nilBonus
    } else {
      if (taken >= bid) {
        bagsEarned = taken - bid
        score = bid * 10 + bagsEarned
      } else {
        score = -bid * 10
      }
    }
    let newBags = (bags[pos] ?? 0) + bagsEarned
    let penalty = 0
    while (newBags >= bagLimit) {
      newBags -= bagLimit
      penalty += 100
    }
    result[pos] = { bid, taken, bagsEarned, penaltyThisRound: penalty, score: score - penalty, bags: newBags }
  }
  return result
}

export function estimateBotBid(hand, nilEnabled = true, useJD = false) {
  const trumpCount = hand.filter((c) => effectiveSuit(c, useJD) === 'S').length
  const topTrumpCount = hand.filter((c) => isTopTrump(c, useJD)).length
  const highCards = hand.filter((c) => VALUE_RANK[c.value] >= VALUE_RANK['A'] || (effectiveSuit(c, useJD) === 'S' && VALUE_RANK[c.value] >= VALUE_RANK['J'])).length
  const nonTrump = hand.length - trumpCount
  let estimate = Math.round(trumpCount * 0.8 + topTrumpCount * 0.5 + highCards * 0.3 + nonTrump * 0.12)
  let bid = Math.max(1, Math.min(9, estimate))
  if (nilEnabled && trumpCount <= 1 && highCards === 0 && Math.random() < 0.35) {
    bid = 0
  }
  return bid
}

export function botCardChoice(hand, currentTrick, spadesBroken, ledSuit, useJD = false, spadesBreakRule = true) {
  const playable = hand.filter((c) => isPlayable(c, hand, currentTrick, spadesBroken, useJD, spadesBreakRule))
  if (currentTrick.length === 0) {
    const nonTrump = playable.filter((c) => effectiveSuit(c, useJD) !== 'S')
    const pool = nonTrump.length ? nonTrump : playable
    return sortHand(pool)[0]
  }
  const canFollow = playable.some((c) => (ledSuit ? effectiveSuit(c, useJD) === ledSuit : true))
  const followers = canFollow ? playable.filter((c) => effectiveSuit(c, useJD) === ledSuit) : playable
  const sorted = sortHand(followers)
  const isLastToPlay = currentTrick.length === 3
  if (isLastToPlay) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const would = [...currentTrick, { pos: '_me', card: sorted[i] }]
      if (evaluateTrick(would, useJD) === '_me') return sorted[i]
    }
    return sorted[0]
  }
  return sorted[0]
}

export function cardLabel(card) {
  if (card.suit === 'JOKER') return card.value === 'BIG' ? 'Big Joker' : 'Small Joker'
  return `${card.value}${SUIT_SYMBOL[card.suit]}`
}
