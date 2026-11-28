// Replays a bidding moment from a finished hand (every card was played face
// up by the end, so the hands are public) and asks the boss brain for its
// bid many times. The moment: Jokers & Deuces, hand 2 of a family game vs
// Tatsu & Kaida. They held 7 of the 8 big cards yet bid 2 + 2 and took 7.
//   node scripts/bots/replay-bids.mjs [times]
import * as E from '../../supabase/functions/_shared/engine.js'
import { BOSS } from '../../supabase/functions/_shared/pro.js'

const times = Number(process.argv[2] ?? 12)
const c = (id) => {
  if (id === 'JOKER_BIG') return { id, suit: 'JOKER', value: 'BIG' }
  if (id === 'JOKER_SMALL') return { id, suit: 'JOKER', value: 'SMALL' }
  return { id, suit: id.slice(-1), value: id.slice(0, -1) }
}
// Each seat's 13 cards, from the hand's plays.
const hands = {
  1: ['10C', 'AH', 'AD', '8D', '3H', '4D', '3S', 'AS', '6S', 'QS', '5H', '6H', 'JH'].map(c), // Kaida
  3: ['AC', '8H', '6D', 'QD', '9H', '6C', '8C', '2S', '2D', '9C', '4H', 'JOKER_BIG', 'JC'].map(c), // Tatsu
}
const rules = E.normalizeRules({ jokers: true, nil: true, blindNil: true, winScore: 500, boardMinimum: 4 })
const base = () => ({
  v: 2, round: 2, dealer: 0, rules, phase: 'bidding', bids: [null, null, null, null], blind: [false, false, false, false],
  tricks: [0, 0, 0, 0], counts: [13, 13, 13, 13], trick: [], broken: false, events: [{ t: 'deal', round: 2, dealer: 0 }],
  scores: { A: { total: 52, bags: 2 }, B: { total: 51, bags: 1 } },
})
const count = (f) => {
  const t = {}
  for (let i = 0; i < times; i++) {
    const b = f()
    t[b] = (t[b] ?? 0) + 1
  }
  return t
}
console.log('plain estimate: Kaida', E.estimateBid(hands[1], true), '· Tatsu', E.estimateBid(hands[3], true))
console.log('Kaida opening (she bids first):', count(() => BOSS.bid(hands[1], 1, base(), rules, Math.random)))
const afterTwo = () => Object.assign(base(), { bids: [null, 2, 3, null] })
console.log('Tatsu after Kaida 2, Sabe 3:', count(() => BOSS.bid(hands[3], 3, afterTwo(), rules, Math.random)))
console.log('(they took 7 between them)')
