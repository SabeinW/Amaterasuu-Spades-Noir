// The practice coach: explains, in plain words, what a beginner should bid or
// play and why. The picks come from the bots' own logic in the rules engine
// (estimateBid / botPlan), so the coach and the bots never disagree.
import * as E from './engine.js'

const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const ONE = { S: 'spade', H: 'heart', D: 'diamond', C: 'club' }
export const label = (card) => E.cardLabel(card)

function ladder(jd) {
  const deck = jd ? E.buildDeckJD() : E.buildDeck()
  return deck.filter((c) => E.effectiveSuit(c, jd) === 'S').sort((a, b) => E.cardRank(b, jd) - E.cardRank(a, jd))
}

// Why a hand is worth what it is: the cards that should win tricks.
export function bidReasons(hand, jd) {
  const lines = []
  const mine = new Set(hand.map((c) => c.id))
  const trumps = ladder(jd).filter((c) => mine.has(c.id))
  let higherOut = 0
  let held = 0
  for (const c of ladder(jd)) {
    if (!mine.has(c.id)) {
      higherOut++
      continue
    }
    held++
    const below = trumps.length - held
    if (higherOut === 0) lines.push({ cards: [c], text: c.suit === 'JOKER' && c.value === 'BIG' ? 'the highest card in the game — a sure trick' : 'nothing left above it — a sure trick' })
    else if (higherOut === 1 && below >= 1) lines.push({ cards: [c], text: 'only one higher card is out, and you have spades to back it up — likely a trick' })
    else if (higherOut === 2 && below >= 2) lines.push({ cards: [c], text: 'a maybe: two higher cards are out' })
  }
  if (trumps.length > 3) lines.push({ cards: [], text: `${trumps.length} spades — once the others run out of spades, your extras win too` })
  let spare = Math.max(0, trumps.length - 2)
  for (const suit of ['H', 'D', 'C']) {
    const cards = hand.filter((c) => E.effectiveSuit(c, jd) === suit)
    const find = (v) => cards.find((c) => c.value === v)
    const n = cards.length
    if (find('A')) lines.push({ cards: [find('A')], text: n <= 5 ? `usually wins the first time ${SUIT_NAME[suit]} are led` : `a winner, but with ${n} ${SUIT_NAME[suit]} someone may trump it` })
    if (find('K') && n >= 2) lines.push({ cards: [find('K')], text: find('A') ? 'wins after your ace clears the way' : `with another ${ONE[suit]} to protect it, it often wins once the ace is gone` })
    if (n === 0 && spare > 0) {
      lines.push({ cards: [], text: `no ${SUIT_NAME[suit]} — when ${SUIT_NAME[suit]} are led you can trump with a spade` })
      spare--
    } else if (n === 1 && spare > 0) {
      lines.push({ cards: [], text: `only one ${ONE[suit]} — after it's gone you can trump ${SUIT_NAME[suit]}` })
      spare--
    }
  }
  return lines
}

// Everything the bid panel's coach section shows.
export function bidAdvice(hand, view, seat, rules, nameOf) {
  const jd = rules.jokers
  const partner = E.partnerOf(seat)
  const min = E.minimumBid(view, seat, rules)
  const est = E.estimateBid(hand, jd)
  const bid = Math.max(min, est)
  const reasons = bidReasons(hand, jd)
  const trumpCount = hand.filter((c) => E.effectiveSuit(c, jd) === 'S').length
  const highCards = hand.filter((c) => c.value === 'A' || c.value === 'K' || E.isTopTrump(c, jd)).length
  const nilIdea = E.canBidNil(view, seat, rules) && trumpCount <= 2 && highCards === 0 && E.trickEstimate(hand, jd) < 1.2
  const notes = []
  const pb = view.bids[partner]
  if (pb === null || pb === undefined) notes.push(`${nameOf(partner)} (top) is your partner and hasn't bid yet. Your bids add up to one team target.`)
  else if (pb === 0) notes.push(`${nameOf(partner)} bid Nil — they're trying to take no tricks, so your bid has to carry the team.`)
  else notes.push(`${nameOf(partner)} bid ${pb}. With ${bid} from you, your team needs ${pb + bid} tricks.`)
  if (rules.boardRule && min > 1) notes.push(`House rule: your team must bid at least ${rules.boardMinimum} together, so you can't go below ${min}.`)
  if (est < min) notes.push(`Your cards look like about ${est}, but the board rule makes it ${min}.`)
  const named = reasons.map((r) => ({ ...r, cards: r.cards.map((c) => ({ id: c.id, label: label(c) })) }))
  return { bid, reasons: named, notes, nilIdea, nilBonus: rules.nilBonus }
}

// Who is winning the trick so far, and with what.
function winningNow(view, jd) {
  if (!view.trick.length) return null
  const seat = E.evaluateTrick(view.trick, jd)
  return { seat, card: view.trick.find((t) => t.seat === seat).card }
}

// The coach's pick for your card and a sentence on why.
export function playAdvice(hand, view, seat, rules, nameOf) {
  const jd = rules.jokers
  const { card, why } = E.botPlan(hand, seat, view, rules)
  const partner = E.partnerOf(seat)
  const teamBid = [seat, partner].reduce((n, s) => n + (view.bids[s] || 0), 0)
  const teamTaken = view.tricks[seat] + view.tricks[partner]
  const need = Math.max(0, teamBid - teamTaken)
  const opp = [E.nextSeat(seat), E.nextSeat(partner)]
  const oppNeed = Math.max(0, opp.reduce((n, s) => n + (view.bids[s] || 0), 0) - view.tricks[opp[0]] - view.tricks[opp[1]])
  const c = label(card)
  const win = winningNow(view, jd)
  const led = view.trick.length ? E.effectiveSuit(view.trick[0].card, jd) : null

  // The rule that applies right now.
  let rule
  if (!led) {
    const hasOther = hand.some((x) => E.effectiveSuit(x, jd) !== 'S')
    rule = rules.spadesBreak && !view.broken && hasOther ? "You lead this trick. Spades aren't broken yet, so lead any other suit." : 'You lead this trick — any card is allowed.'
  } else if (hand.some((x) => E.effectiveSuit(x, jd) === led)) {
    rule = `${SUIT_NAME[led][0].toUpperCase() + SUIT_NAME[led].slice(1)} were led — you have to play a ${ONE[led]}.`
  } else {
    const canTrump = led !== 'S' && hand.some((x) => E.effectiveSuit(x, jd) === 'S')
    rule = `You're out of ${SUIT_NAME[led]}, so any card is allowed${canTrump ? ' — a spade would trump it' : ''}.`
  }

  const winner = win ? `${win.seat === seat ? 'You are' : win.seat === partner ? `${nameOf(partner)} (your partner) is` : `${nameOf(win.seat)} is`} winning with ${label(win.card)}.` : null
  const tip = {
    'nil-lead': `You bid Nil, so you want to lose every trick. Lead a low card like ${c}.`,
    'nil-duck': `You bid Nil — play ${c}, your highest card that still loses, and save your low cards for later.`,
    'cash-winner': `Your team still needs ${need}. Lead ${c} — it should win.`,
    'lead-low': need > 0 ? `Lead ${c}, your weakest card outside spades, and keep the rest for when they count.` : `Your team already has its ${teamBid}. Lead ${c}, your weakest card — extra tricks are bags.`,
    'partner-nil-cover': `${nameOf(partner)} bid Nil and is about to win this trick. Cover with ${c} so they don't take it.`,
    'partner-winning': `Your partner already has this one, so play your lowest: ${c}.`,
    'opp-nil-duck': `${nameOf(win?.seat)} bid Nil and is winning. Let them take it — that breaks their Nil and costs them ${rules.nilBonus}.`,
    'take-for-bid': `Your team still needs ${need}. ${c} is your cheapest card that wins.`,
    'take-to-set': `Your team has its bid, but the other team still needs ${oppNeed}. Win it with ${c} to stop them making theirs.`,
    'avoid-bags': `Your team already made its bid. Play ${c} and let this one go — extra tricks are bags.`,
    'cant-win': `You can't beat ${label(win?.card ?? card)}, so throw your lowest: ${c}.`,
    'cant-follow-trump': `No ${SUIT_NAME[led]} left — trump it with ${c}, the cheapest spade that wins.`,
    'cant-follow-duck': `No ${SUIT_NAME[led] ?? 'cards of that suit'} left. Throw away ${c}, your least useful card.`,
  }[why]
  const legal = hand.filter((x) => E.isPlayable(x, hand, view.trick, view.broken, jd, rules.spadesBreak))
  return { cardId: card.id, rule, winner, tip: legal.length === 1 ? `${c} is the only card you can play.` : tip }
}

// One line on why the last trick went where it did.
export function trickStory(lastTrick, rules, nameOf, mySeat) {
  if (!lastTrick?.cards?.length) return null
  const jd = rules.jokers
  const { winner } = lastTrick
  const card = lastTrick.cards.find((t) => t.seat === winner)?.card
  if (!card) return null
  const led = E.effectiveSuit(lastTrick.cards[0].card, jd)
  const who = winner === mySeat ? 'You' : nameOf(winner)
  let why
  if (card.suit === 'JOKER') why = card.value === 'BIG' ? 'the Big Joker beats everything' : 'only the Big Joker beats the Little Joker'
  else if (E.isTopTrump(card, jd)) why = led === 'S' ? `with Jokers & Deuces, the ${label(card)} is above the A♠` : `the ${label(card)} counts as a spade, and a spade beats any ${ONE[led]}`
  else if (E.effectiveSuit(card, jd) === 'S' && led !== 'S') why = `a spade beats any ${ONE[led]}`
  else why = `highest ${ONE[led]} played`
  return `${who} won the trick with ${label(card)} — ${why}.`
}

// Why a card you tapped can't be played.
export function blockedReason(card, hand, view, rules) {
  const jd = rules.jokers
  if (!view.trick.length) return "Spades aren't broken yet — lead another suit first."
  const led = E.effectiveSuit(view.trick[0].card, jd)
  const what = E.isTopTrump(card, jd) && led !== 'S' ? ` (${label(card)} counts as a spade)` : ''
  return `${SUIT_NAME[led][0].toUpperCase() + SUIT_NAME[led].slice(1)} were led — you have to play a ${ONE[led]}${what}.`
}

// How the round's points were worked out, for the round summary.
export function roundStory(result, myTeam, rules, nameOf) {
  const lines = []
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  for (const team of [myTeam, myTeam === 'A' ? 'B' : 'A']) {
    const r = result[team]
    const who = team === myTeam ? 'Your team' : 'They'
    if (r.bid > 0) {
      if (r.made) lines.push(`${who} bid ${r.bid} and took ${r.taken}: ${r.bid} × 10 = +${r.bid * 10}${r.bagsEarned ? `, plus ${plural(r.bagsEarned, 'bag')} (+${r.bagsEarned})` : ''}.`)
      else lines.push(`${who} bid ${r.bid} but took only ${r.taken}: −${r.bid * 10}.`)
    }
    for (const n of r.nils) lines.push(`${nameOf(n.seat)}'s ${n.blind ? 'Blind Nil' : 'Nil'} ${n.ok ? 'held' : 'broke'}: ${n.points > 0 ? '+' : ''}${n.points}.`)
    if (r.penalty) lines.push(`${who === 'They' ? 'Their' : 'Your'} bags reached ${rules.bagLimit}: −${r.penalty}.`)
  }
  if (rules.bagPenalty) lines.push(`Bags count toward a −100 penalty every ${rules.bagLimit}. Yours: ${result[myTeam].bags}.`)
  return lines
}
