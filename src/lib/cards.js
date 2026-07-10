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

export function buildDeckJD() {
  const deck = buildDeck().filter((c) => !(c.suit !== 'S' && c.value === '2'))
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

function cardRank(card, useJD) {
  if (card.suit === 'JOKER') return card.value === 'BIG' ? 1000 : 999
  return VALUE_RANK[card.value]
}

export function beats(card, winnerCard, ledSuit, useJD = false) {
  if (useJD && card.suit === 'JOKER') return true
  if (useJD && winnerCard.suit === 'JOKER') return false
  if (card.suit === winnerCard.suit) return cardRank(card, useJD) > cardRank(winnerCard, useJD)
  if (card.suit === 'S' && winnerCard.suit !== 'S') return true
  if (card.suit !== 'S' && winnerCard.suit === 'S') return false
  if (card.suit === ledSuit && winnerCard.suit !== ledSuit) return true
  return false
}

export function evaluateTrick(trick, useJD = false) {
  let winner = trick[0]
  const ledSuit = trick[0].card.suit === 'JOKER' ? 'S' : trick[0].card.suit
  for (const entry of trick.slice(1)) {
    if (beats(entry.card, winner.card, ledSuit, useJD)) winner = entry
  }
  return winner.pos
}

export function isPlayable(card, hand, currentTrick, spadesBroken, useJD = false) {
  if (currentTrick.length === 0) {
    if (card.suit === 'S' && !spadesBroken && hand.some((c) => c.suit !== 'S')) return false
    return true
  }
  const ledSuit = currentTrick[0].card.suit === 'JOKER' ? 'S' : currentTrick[0].card.suit
  const hasLedSuit = hand.some((c) => (c.suit === 'JOKER' ? ledSuit === 'S' : c.suit === ledSuit))
  if (hasLedSuit) {
    if (card.suit === 'JOKER') return ledSuit === 'S'
    return card.suit === ledSuit
  }
  return true
}

export function scoreRound(bids, tricks, bags, settings = {}) {
  const nilBonus = settings.nilBonus ?? 100
  const bagLimit = settings.bagLimit ?? 10
  const result = {}
  for (const pos of POSITIONS) {
    const bid = bids[pos] ?? 0
    const taken = tricks[pos] ?? 0
    let score = 0
    let bagsEarned = 0
    if (bid === 0) {
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

export function estimateBotBid(hand, nilEnabled = true) {
  const spadesCount = hand.filter((c) => c.suit === 'S').length
  const highCards = hand.filter((c) => VALUE_RANK[c.value] >= VALUE_RANK['A'] || (c.suit === 'S' && VALUE_RANK[c.value] >= VALUE_RANK['J'])).length
  const nonSpades = hand.length - spadesCount
  let estimate = Math.round(spadesCount * 0.8 + highCards * 0.3 + nonSpades * 0.12)
  let bid = Math.max(1, Math.min(9, estimate))
  if (nilEnabled && spadesCount <= 1 && highCards === 0 && Math.random() < 0.35) {
    bid = 0
  }
  return bid
}

export function botCardChoice(hand, currentTrick, spadesBroken, ledSuit, useJD = false) {
  const playable = hand.filter((c) => isPlayable(c, hand, currentTrick, spadesBroken, useJD))
  if (currentTrick.length === 0) {
    const nonSpades = playable.filter((c) => c.suit !== 'S')
    const pool = nonSpades.length ? nonSpades : playable
    return sortHand(pool)[0]
  }
  const winningNow = currentTrick.length ? evaluateTrick(currentTrick, useJD) : null
  const canFollow = playable.some((c) => (ledSuit ? c.suit === ledSuit : true))
  const followers = canFollow ? playable.filter((c) => c.suit === ledSuit) : playable
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
