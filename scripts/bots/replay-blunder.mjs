// Replays a moment from a finished hand (every card public by then) and
// asks the pro brain what it would play, many times, to see if a blunder
// is a bug or bad luck. The moment: Jokers & Deuces, round 5 of a family
// game, trick 11. Jada (seat 3) led the 8♠, Sabe (seat 0) is winning with
// the 9♠, Malik (seat 1) has no spades and holds K♦ 3♦ 9♣; the K♦ is the
// highest diamond left. Throwing it away is a blunder.
//   node scripts/bots/replay-blunder.mjs [times] [joker]   (joker: trick 7,
//   the Big Joker led and Malik holding the Little Joker, 3♠ and J♠)
import * as E from '../../supabase/functions/_shared/engine.js'
import { proCard, roundKnowledge } from '../../supabase/functions/_shared/pro.js'

const times = Number(process.argv[2] ?? 20)
const c = (id) => {
  if (id === 'JOKER_BIG') return { id, suit: 'JOKER', value: 'BIG' }
  if (id === 'JOKER_SMALL') return { id, suit: 'JOKER', value: 'SMALL' }
  return { id, suit: id.slice(-1), value: id.slice(0, -1) }
}
// Round 5 tricks (leader first), from the public play-by-play.
const tricks = [
  [0, 'AC', '6C', 'JC', '3C'],
  [0, 'KC', '4C', '5H', '5C'],
  [0, 'QC', '7C', '6H', '10C'],
  [0, 'QH', 'JH', '7H', '8H'],
  [0, '9D', '7D', 'AD', '8D'],
  [2, 'KH', '3H', 'AS', '4H'],
  [0, 'JOKER_BIG', 'JOKER_SMALL', '4S', '6S'],
  [0, '10S', '3S', '2D', 'QS'],
  [2, 'AH', 'KS', '4D', '8C'],
  [3, '2S', '5S', 'JS', '9H'],
  [3, '8S', '9S'],
]
const rules = E.normalizeRules({ jokers: true, nil: true, blindNil: true, winScore: 500, boardMinimum: 4 })
const pub = {
  v: 2, round: 5, dealer: 3, rules, phase: 'playing', bids: [4, 2, 3, 3], blind: [false, false, false, false],
  tricks: [0, 0, 0, 0], counts: [13, 13, 13, 13], trick: [], broken: false, events: [{ t: 'deal', round: 5, dealer: 3 }],
  scores: { A: { total: 173, bags: 3 }, B: { total: 196, bags: 6 } },
}
const upTo = process.argv[3] === 'joker' ? 7 : tricks.length
for (const [lead, ...ids] of tricks.slice(0, upTo).map((t, i) => (i === 6 && upTo === 7 ? [t[0], t[1]] : t))) {
  pub.trick = []
  ids.forEach((id, k) => {
    const seat = (lead + k) % 4
    const card = c(id)
    pub.trick.push({ seat, card })
    pub.counts[seat]--
    if (E.effectiveSuit(card, true) === 'S') pub.broken = true
    pub.events.push({ t: 'play', seat, card })
  })
  if (pub.trick.length === 4) {
    const w = E.evaluateTrick(pub.trick, true)
    pub.tricks[w]++
    pub.events.push({ t: 'trick', winner: w, cards: pub.trick })
  }
}
const hand = (upTo === 7 ? ['JOKER_SMALL', '3S', '8C', 'JS', 'KD', '3D', '9C'] : ['KD', '3D', '9C']).map(c)
console.log('tricks so far', pub.tricks, 'trick on table', pub.trick.map((t) => t.card.id).join(' '), 'counts', pub.counts)
console.log('what Malik knows:', JSON.stringify([...roundKnowledge(pub).voids].map((v) => [...v])))
const tally = {}
const debug = []
for (let i = 0; i < times; i++) {
  const card = proCard(hand, 1, pub, rules, Math.random, i < 3 ? { debug } : {})
  tally[card.id] = (tally[card.id] ?? 0) + 1
}
console.log('pro brain picks:', tally)
console.log('average value of each choice (first 3 runs):', debug)
console.log('quick rules pick:', E.botCard(hand, 1, pub, rules).id)
