import { scoreRound } from '../src/lib/cards.js'

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`)
  if (!ok) console.log('  got:', JSON.stringify(actual), '\n  expected:', JSON.stringify(expected))
  if (ok) pass++
  else fail++
}

const zeroBags = { bottom: 0, left: 0, top: 0, right: 0 }

// User's own example: team1 (bottom=3, top=4 => combined 7), team2 (left=2, right=2 => combined 4).
// One partner overshoots exactly enough to cover the other's shortfall —
// team should succeed with zero bags, both partners score identically.
{
  const bids = { bottom: 3, top: 4, left: 2, right: 2 }
  const tricks = { bottom: 5, top: 2, left: 2, right: 2 } // team1: 5+2=7 (exact), team2: 2+2=4 (exact)
  const detail = scoreRound(bids, tricks, zeroBags, { partnershipMode: true })
  check('team1 exact combined bid — no bags, positive score for BOTH partners', {
    bottom: detail.bottom.score, top: detail.top.score, bottomBags: detail.bottom.bagsEarned, topBags: detail.top.bagsEarned,
  }, { bottom: 70, top: 70, bottomBags: 0, topBags: 0 })
  check('team2 exact combined bid — no bags, positive score for BOTH partners', {
    left: detail.left.score, right: detail.right.score,
  }, { left: 40, right: 40 })
}

// Team combined overshoot — genuine bags only for the true overflow beyond
// the combined bid, not per-individual overflow.
{
  const bids = { bottom: 3, top: 4, left: 2, right: 2 }
  const tricks = { bottom: 6, top: 3, left: 2, right: 2 } // team1: 6+3=9 vs combined 7 => 2 bags
  const detail = scoreRound(bids, tricks, zeroBags, { partnershipMode: true })
  check('team1 overshoots combined bid by 2 — exactly 2 bags shared, score 72 each', {
    bottom: detail.bottom.score, top: detail.top.score, bottomBags: detail.bottom.bags, topBags: detail.top.bags,
  }, { bottom: 72, top: 72, bottomBags: 2, topBags: 2 })
}

// Team falls short of combined bid — both partners share the loss even
// though one of them individually "made" their own bid.
{
  const bids = { bottom: 3, top: 4, left: 2, right: 2 }
  const tricks = { bottom: 3, top: 2, left: 4, right: 4 } // team1: 3+2=5 vs combined 7 => fails
  const detail = scoreRound(bids, tricks, zeroBags, { partnershipMode: true })
  check('team1 falls short of combined bid — both partners lose -70 even though bottom made their own 3', {
    bottom: detail.bottom.score, top: detail.top.score,
  }, { bottom: -70, top: -70 })
}

// Nil partner + regular partner: nil scored individually, regular partner's
// bid checked against the TEAM's combined tricks (including the nil
// bidder's accidental tricks, since total tricks must reconcile to 13).
{
  const bids = { bottom: 0, top: 4, left: 3, right: 3 }
  const tricks = { bottom: 1, top: 5, left: 2, right: 2 } // nil FAILS (-100); team combined 1+5=6 >= 4 => +40+2bags
  const detail = scoreRound(bids, tricks, zeroBags, { partnershipMode: true }, { bottom: false })
  check('nil fails but partner still covers the numeric bid — net team score reflects both', {
    bottom: detail.bottom.score, top: detail.top.score,
  }, { bottom: -100 + 40 + 2, top: -100 + 40 + 2 })
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
