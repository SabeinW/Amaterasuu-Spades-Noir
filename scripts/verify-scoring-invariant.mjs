import { scoreRound } from '../src/lib/cards.js'

const POSITIONS = ['bottom', 'left', 'top', 'right']
let violations = []
let checked = 0

function randInt(max) { return Math.floor(Math.random() * (max + 1)) }

for (let trial = 0; trial < 200000; trial++) {
  // Random bids (0-13, weighted toward smaller/typical values) and random
  // tricks that sum to exactly 13 across the 4 seats (a real deal always
  // distributes exactly 13 tricks).
  const bids = {}
  const blindNil = {}
  for (const p of POSITIONS) {
    bids[p] = Math.random() < 0.15 ? 0 : randInt(9)
    blindNil[p] = bids[p] === 0 && Math.random() < 0.3
  }
  let remaining = 13
  const tricks = {}
  for (let i = 0; i < POSITIONS.length; i++) {
    const p = POSITIONS[i]
    const isLast = i === POSITIONS.length - 1
    const take = isLast ? remaining : randInt(remaining)
    tricks[p] = take
    remaining -= take
  }
  // Random pre-existing bags (0..bagLimit-1, since a real running total
  // never sits AT the limit — it resets immediately on crossing).
  const bagLimit = 10
  const bags = {}
  for (const p of POSITIONS) bags[p] = randInt(bagLimit - 1)

  for (const partnership of [true, false]) {
    const settings = { partnershipMode: partnership, nilBonus: 100, bagLimit }
    const detail = scoreRound(bids, tricks, bags, settings, blindNil)
    checked++

    for (const p of POSITIONS) {
      const d = detail[p]
      if (d.score >= 0) continue // only auditing NEGATIVE outcomes

      // Was there a bag-limit crossing this round? (individual mode: this
      // seat's own bags; team mode: the team's shared bag pool.)
      const hadBagPenalty = d.penaltyThisRound > 0

      // Did this seat (or, in team mode, the team as a whole) fail to make
      // its bid/nil?
      let failedBidOrNil
      if (!partnership) {
        failedBidOrNil = bids[p] === 0 ? tricks[p] !== 0 : tricks[p] < bids[p]
      } else {
        const partner = p === 'bottom' ? 'top' : p === 'top' ? 'bottom' : p === 'left' ? 'right' : 'left'
        const teamBidNil = bids[p] === 0
        const partnerBidNil = bids[partner] === 0
        const nilFailed = (teamBidNil && tricks[p] !== 0) || (partnerBidNil && tricks[partner] !== 0)
        const nonNilBidTotal = (teamBidNil ? 0 : bids[p]) + (partnerBidNil ? 0 : bids[partner])
        const combinedTricks = tricks[p] + tricks[partner]
        const regularBidFailed = nonNilBidTotal > 0 && combinedTricks < nonNilBidTotal
        failedBidOrNil = nilFailed || regularBidFailed
      }

      if (!hadBagPenalty && !failedBidOrNil) {
        violations.push({ partnership, pos: p, bids, tricks, bags, detail: d })
      }
    }
  }
}

console.log(`checked ${checked} seat-scenarios across trials`)
console.log(`violations found: ${violations.length}`)
if (violations.length) {
  console.log(JSON.stringify(violations.slice(0, 5), null, 2))
}
