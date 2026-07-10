import { buildDeckJD, dealHands, evaluateTrick, isPlayable, effectiveSuit, isTopTrump, POSITIONS } from '../src/lib/cards.js'

// 1. JD deck is exactly 52 cards, 13 per player, with 2♦/2♠ kept and 2♣/2♥ dropped.
const deck = buildDeckJD()
console.assert(deck.length === 52, `JD deck should be 52 cards, got ${deck.length}`)
console.assert(deck.some((c) => c.id === '2D'), '2 of diamonds should survive in JD deck')
console.assert(deck.some((c) => c.id === '2S'), '2 of spades should survive in JD deck')
console.assert(!deck.some((c) => c.id === '2C'), '2 of clubs should be removed in JD deck')
console.assert(!deck.some((c) => c.id === '2H'), '2 of hearts should be removed in JD deck')
console.assert(deck.filter((c) => c.suit === 'JOKER').length === 2, 'should have exactly 2 jokers')

const hands = dealHands(true)
console.assert(POSITIONS.every((p) => hands[p].length === 13), 'each JD hand should have 13 cards')

// 2. Rank hierarchy: Big Joker > Little Joker > 2♦ > 2♠ > A♠ > ... > 3♠ > (other suits)
const bigJoker = { suit: 'JOKER', value: 'BIG' }
const littleJoker = { suit: 'JOKER', value: 'SMALL' }
const twoD = { suit: 'D', value: '2' }
const twoS = { suit: 'S', value: '2' }
const aceS = { suit: 'S', value: 'A' }
const threeS = { suit: 'S', value: '3' }
const aceH = { suit: 'H', value: 'A' }

function winnerOf(a, b) {
  const trick = [{ pos: 'a', card: a }, { pos: 'b', card: b }]
  return evaluateTrick(trick, true)
}

console.assert(winnerOf(bigJoker, littleJoker) === 'a', 'Big Joker should beat Little Joker')
console.assert(winnerOf(littleJoker, twoD) === 'a', 'Little Joker should beat 2 of Diamonds')
console.assert(winnerOf(twoD, twoS) === 'a', '2 of Diamonds should beat 2 of Spades')
console.assert(winnerOf(twoS, aceS) === 'a', '2 of Spades should beat Ace of Spades')
console.assert(winnerOf(aceS, threeS) === 'a', 'Ace of Spades should beat 3 of Spades (normal spade order below the top trumps)')
console.assert(winnerOf(threeS, aceH) === 'a', 'Any spade (trump) should beat any Ace of a non-trump suit')

// 3. effectiveSuit / isTopTrump
console.assert(effectiveSuit(twoD, true) === 'S', '2 of Diamonds should count as spades (trump) in JD mode')
console.assert(effectiveSuit(twoD, false) === 'D', '2 of Diamonds should stay a diamond outside JD mode')
console.assert(isTopTrump(bigJoker, true) === true, 'Big Joker is a top trump in JD mode')
console.assert(isTopTrump(aceS, true) === false, 'Ace of Spades is NOT a top trump (only jokers/2D/2S are)')

// 4. Following suit: if diamonds led and you hold 2♦, it must follow as trump (spades), not as a diamond
const ledDiamond = [{ pos: 'lead', card: { suit: 'D', value: 'K' } }]
const handWithTwoD = [twoD, { suit: 'D', value: '5', id: '5D' }, { suit: 'H', value: '4', id: '4H' }]
console.assert(isPlayable(twoD, handWithTwoD, ledDiamond, false, true) === false, '2 of Diamonds cannot follow a diamond lead — it is trump, not a diamond, in JD mode')
console.assert(isPlayable({ suit: 'D', value: '5', id: '5D' }, handWithTwoD, ledDiamond, false, true) === true, 'the real diamond in hand must be played to follow suit')

// 5. Leading with 2♦ sets the led suit to spades (trump)
const ledByTwoD = [{ pos: 'lead', card: twoD }]
const handFollow = [{ suit: 'S', value: '5', id: '5S' }, { suit: 'H', value: '4', id: '4H' }]
console.assert(isPlayable({ suit: 'S', value: '5', id: '5S' }, handFollow, ledByTwoD, false, true) === true, 'a real spade should be able to follow a 2-of-diamonds lead (it led trump)')
console.assert(isPlayable({ suit: 'H', value: '4', id: '4H' }, handFollow, ledByTwoD, false, true) === false, 'a non-trump card should not be playable when 2 of Diamonds led trump and a trump is held')

console.log('All Jokers & Deuces logic assertions passed.')
