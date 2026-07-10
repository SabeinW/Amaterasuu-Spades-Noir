import { dealHands, evaluateTrick, scoreRound, isPlayable, estimateBotBid, botCardChoice, POSITIONS } from '../src/lib/cards.js'

// 1. Deal sanity
const hands = dealHands(false)
console.assert(POSITIONS.every((p) => hands[p].length === 13), 'each hand should have 13 cards')
const allIds = new Set(POSITIONS.flatMap((p) => hands[p].map((c) => c.id)))
console.assert(allIds.size === 52, `expected 52 unique cards, got ${allIds.size}`)

// 2. Trick evaluation: spade beats everything, highest of led suit wins otherwise
const trick1 = [
  { pos: 'bottom', card: { suit: 'H', value: '10' } },
  { pos: 'left', card: { suit: 'H', value: 'K' } },
  { pos: 'top', card: { suit: 'S', value: '2' } },
  { pos: 'right', card: { suit: 'H', value: 'A' } },
]
console.assert(evaluateTrick(trick1) === 'top', `spade should win, got ${evaluateTrick(trick1)}`)

const trick2 = [
  { pos: 'bottom', card: { suit: 'C', value: '5' } },
  { pos: 'left', card: { suit: 'C', value: 'A' } },
  { pos: 'top', card: { suit: 'D', value: 'K' } },
  { pos: 'right', card: { suit: 'C', value: 'Q' } },
]
console.assert(evaluateTrick(trick2) === 'left', `A of led suit should win, got ${evaluateTrick(trick2)}`)

// 3. isPlayable: cannot lead spades before broken if other suits available
const handWithSpade = [{ suit: 'S', value: 'A', id: 'AS' }, { suit: 'H', value: '4', id: '4H' }]
console.assert(isPlayable({ suit: 'S', value: 'A', id: 'AS' }, handWithSpade, [], false) === false, 'should not be able to lead spade before broken')
console.assert(isPlayable({ suit: 'H', value: '4', id: '4H' }, handWithSpade, [], false) === true, 'should be able to lead non-spade')

// must follow suit if possible
const followHand = [{ suit: 'H', value: '4', id: '4H' }, { suit: 'D', value: '5', id: '5D' }]
const ledHeart = [{ pos: 'left', card: { suit: 'H', value: 'K' } }]
console.assert(isPlayable({ suit: 'D', value: '5', id: '5D' }, followHand, ledHeart, false) === false, 'must follow suit when possible')
console.assert(isPlayable({ suit: 'H', value: '4', id: '4H' }, followHand, ledHeart, false) === true, 'following suit should be playable')

// 4. Scoring: bid made, bid failed, nil made, nil failed, bag penalty
const bids = { bottom: 4, left: 0, top: 3, right: 5 }
const tricks = { bottom: 6, left: 0, top: 2, right: 5 }
const bags = { bottom: 9, left: 0, top: 0, right: 0 }
const result = scoreRound(bids, tricks, bags, { nilBonus: 100, bagLimit: 10 })
console.assert(result.bottom.score === 40 + 2 - 100, `bottom (bid 4 made w/ 2 bags, bag limit hit) score wrong: ${result.bottom.score}`)
console.assert(result.left.score === 100, `left nil made should be +100, got ${result.left.score}`)
console.assert(result.top.score === -30, `top bid 3 failed (only 2) should be -30, got ${result.top.score}`)
console.assert(result.right.score === 50, `right bid 5 exact should be +50, got ${result.right.score}`)

// 5. Bot bidding stays in range
for (let i = 0; i < 50; i++) {
  const bid = estimateBotBid(hands.left, true)
  console.assert(bid >= 0 && bid <= 13, `bot bid out of range: ${bid}`)
}

// 6. Bot card choice always returns a playable card
const trickInProgress = [{ pos: 'bottom', card: { suit: 'D', value: '5', id: '5D' } }]
const botHand = [{ suit: 'D', value: 'K', id: 'KD' }, { suit: 'S', value: 'A', id: 'AS' }]
const choice = botCardChoice(botHand, trickInProgress, false, 'D', false)
console.assert(choice.suit === 'D', `bot should follow suit when able, played ${choice.suit}`)

console.log('All logic assertions passed.')
