import { botCardChoice } from '../src/lib/cards.js'

function card(id) {
  const suit = id.slice(-1)
  const value = id.slice(0, -1)
  return { suit, value, id }
}

let pass = 0, fail = 0
function check(name, actual, expected) {
  const ok = actual === expected
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}: got ${actual}, expected ${expected}`)
  if (ok) pass++
  else fail++
}

// 1) Teammate (top) already winning trick with a mid spade, bot (bottom) is
// last to play and holds a much higher spade + a worthless club. Bot should
// NOT waste its high spade beating its own partner — should duck with the
// low club instead (void case: has both suits available here since led suit
// was clubs by 'left').
{
  const hand = [card('2C'), card('AS')]
  const currentTrick = [
    { pos: 'left', card: card('5C') },   // led clubs
    { pos: 'top', card: card('9S') },    // partner discards a spade (void in clubs) — currently winning as trump
    { pos: 'right', card: card('3C') },
  ]
  const bid = botCardChoice(hand, currentTrick, true, 'C', false, true, { pos: 'bottom', bids: { bottom: 4, left: 3, top: 3, right: 3 }, tricksTaken: { bottom: 0, left: 0, top: 0, right: 0 } })
  check('duck behind winning teammate instead of overtrumping', bid.id, '2C')
}

// 2) Opponent (left) currently winning with a decent spade, bot (bottom) is
// last to play, holds a spade that beats it and a much higher spade too.
// Bot should win with the CHEAPEST sufficient card, not its best spade.
{
  const hand = [card('6S'), card('AS')]
  const currentTrick = [
    { pos: 'left', card: card('5S') },
    { pos: 'top', card: card('2S') },
    { pos: 'right', card: card('3S') },
  ]
  const bid = botCardChoice(hand, currentTrick, true, 'S', false, true, { pos: 'bottom', bids: { bottom: 2, left: 3, top: 3, right: 3 }, tricksTaken: { bottom: 0, left: 0, top: 0, right: 0 } })
  check('win over opponent with cheapest sufficient card, not the Ace', bid.id, '6S')
}

// 3) Partner (top) bid Nil and is currently winning the trick by accident —
// bot (bottom) must rescue by overtaking, even though normally it would duck
// behind a winning teammate.
{
  const hand = [card('2C'), card('AC')]
  const currentTrick = [
    { pos: 'left', card: card('4C') },
    { pos: 'top', card: card('9C') },   // nil partner accidentally winning
    { pos: 'right', card: card('5C') },
  ]
  const bid = botCardChoice(hand, currentTrick, false, 'C', false, true, { pos: 'bottom', bids: { bottom: 3, left: 3, top: 0, right: 3 }, tricksTaken: { bottom: 0, left: 0, top: 0, right: 0 } })
  check('rescue nil-bidding partner by overtaking', bid.id, 'AC')
}

// 4) Leading a fresh trick, bot still needs tricks toward its bid and holds
// an Ace — should lead the Ace to actively bank a trick instead of leading low.
{
  const hand = [card('3H'), card('AH'), card('7D')]
  const bid = botCardChoice(hand, [], false, null, false, true, { pos: 'bottom', bids: { bottom: 4, left: 2, top: 2, right: 2 }, tricksTaken: { bottom: 0, left: 0, top: 0, right: 0 } })
  check('lead a near-certain winner when still short of bid', bid.id, 'AH')
}

// 5) Leading a fresh trick, bot has ALREADY made its bid — should lead low
// (no Ace-leading needed), preserving old conservative-lead behavior.
{
  const hand = [card('3H'), card('AH'), card('7D')]
  const bid = botCardChoice(hand, [], false, null, false, true, { pos: 'bottom', bids: { bottom: 2, left: 2, top: 2, right: 2 }, tricksTaken: { bottom: 2, left: 0, top: 0, right: 0 } })
  check('lead low once bid is already met', bid.id, '3H')
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
