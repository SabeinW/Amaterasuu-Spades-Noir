// The cards in the middle of the table.
//
// Playing: each card glides in from the seat that played it (yours from the
// exact spot it left your hand) and settles with a slight hand-placed tilt.
//
// Trick won — a short sequence, timed by game/timing.js:
//   1. lift:   the winning card rises and glows gold; a banner names the winner
//   2. hold:   everyone gets a beat to see who took it
//   3. gather: the four cards slide together into one stack under the winner's card
//   4. sweep:  the stack flies to the winner's seat and shrinks away
//              (GameTable then flashes that seat and ticks its trick count up)
import { AnimatePresence, motion } from 'motion/react'
import Card from '../cards/Card'
import { jitter, pileAnchor, seatAnchor, slotOf, tableCenter, trickSlot } from './geometry'
import { T } from '../../game/timing'

const EASE_OUT = [0.22, 1, 0.36, 1]

function PlayedCard({ entry, mySeat, w, h, cw, deck, fromRect }) {
  const slot = slotOf(entry.seat, mySeat)
  const c = tableCenter(w, h)
  const s = trickSlot(slot, cw)
  const ch = cw * 1.4
  const rest = { x: c.x + s.x - cw / 2, y: c.y + s.y - ch / 2, rotate: s.r + jitter(entry.card.id, 7) }
  const from = fromRect ?? seatAnchor(slot, w, h, cw)
  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ zIndex: 20 }}
      initial={{
        x: from.x - cw / 2,
        y: from.y - ch / 2,
        rotate: slot === 'left' ? -50 : slot === 'right' ? 50 : jitter(entry.card.id, 18),
        scale: slot === 'bottom' ? 1.2 : 0.62,
        opacity: slot === 'bottom' ? 1 : 0.3,
      }}
      animate={{ ...rest, scale: 1, opacity: 1 }}
      transition={{ duration: T.cardFlight, ease: EASE_OUT }}
    >
      <div style={{ filter: 'drop-shadow(0 10px 14px rgb(0 0 0 / 0.5))' }}>
        <Card card={entry.card} deck={deck} width={cw} />
      </div>
    </motion.div>
  )
}

function SweepCard({ entry, order, winner, mySeat, w, h, cw, deck }) {
  const slot = slotOf(entry.seat, mySeat)
  const c = tableCenter(w, h)
  const s = trickSlot(slot, cw)
  const ch = cw * 1.4
  const isWinner = entry.seat === winner
  const rest = { x: c.x + s.x - cw / 2, y: c.y + s.y - ch / 2, r: s.r + jitter(entry.card.id, 7) }
  // stacked under the winning card, a hair offset each so it reads as a pile
  const stack = { x: c.x - cw / 2 + (isWinner ? 0 : (order - 1.5) * 3), y: c.y - ch / 2 + (isWinner ? -2 : order * 2), r: isWinner ? 0 : (order - 1.5) * 6 }
  const to = pileAnchor(slotOf(winner, mySeat), w, h, cw)
  const end = { x: to.x - cw / 2, y: to.y - ch / 2 }
  const lift = isWinner ? -cw * 0.22 : 0

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ zIndex: isWinner ? 32 : 22 + order }}
      initial={false}
      animate={{
        x: [rest.x, rest.x, rest.x, stack.x, end.x],
        y: [rest.y, rest.y + lift, rest.y + lift, stack.y, end.y],
        rotate: [rest.r, isWinner ? 0 : rest.r, isWinner ? 0 : rest.r, stack.r, stack.r + 18],
        scale: [1, isWinner ? 1.14 : 0.94, isWinner ? 1.14 : 0.94, 1, 0.42],
        opacity: [1, 1, 1, 1, 0],
      }}
      transition={{
        duration: T.sweep,
        times: [0, T.sweepLift, T.sweepHold, T.sweepGather, 1],
        ease: [EASE_OUT, 'linear', [0.45, 0, 0.2, 1], [0.55, 0, 0.75, 0.25]],
      }}
    >
      <motion.div
        style={{ borderRadius: cw * 0.08 }}
        animate={
          isWinner
            ? { boxShadow: ['0 0 0 0 rgb(241 210 138 / 0)', '0 0 0 2px #f1d28a, 0 0 34px 8px rgb(241 210 138 / 0.6)', '0 0 0 2px #f1d28a, 0 0 34px 8px rgb(241 210 138 / 0.6)', '0 0 0 0 rgb(241 210 138 / 0)'] }
            : { filter: ['brightness(1)', 'brightness(0.72)', 'brightness(0.72)', 'brightness(1)'] }
        }
        transition={{ duration: T.sweep * T.sweepGather, times: [0, 0.18, 0.8, 1] }}
      >
        <Card card={entry.card} deck={deck} width={cw} />
      </motion.div>
    </motion.div>
  )
}

function WinBanner({ text, mine, top }) {
  return (
    <motion.div
      className="absolute left-1/2 z-40 pointer-events-none"
      style={{ top }}
      initial={{ opacity: 0, y: 10, x: '-50%', scale: 0.9 }}
      animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -8], x: '-50%', scale: [0.9, 1, 1, 0.98] }}
      transition={{ duration: T.sweep * T.sweepGather + 0.15, times: [0, 0.16, 0.82, 1] }}
    >
      <div
        className="whitespace-nowrap rounded-full px-4 py-1.5 font-display font-extrabold tracking-wide text-[15px]"
        style={
          mine
            ? { background: 'linear-gradient(135deg,#f6dc9a,#d4a64a 55%,#a37a2c)', color: '#1b1307', boxShadow: '0 8px 28px -6px rgb(212 166 74 / 0.8)' }
            : { background: 'rgb(20 17 13 / 0.85)', color: '#f6dc9a', border: '1px solid rgb(212 166 74 / 0.45)', backdropFilter: 'blur(8px)' }
        }
      >
        {text}
      </div>
    </motion.div>
  )
}

export default function TrickArea({ view, event, mySeat, w, h, cw, deck, fromRects, nameOf, partnerSeat }) {
  if (!view || !w) return null
  const sweeping = event?.t === 'trick' ? event : null
  const c = tableCenter(w, h)
  let bannerText = null
  if (sweeping) {
    const wSeat = sweeping.winner
    if (wSeat === mySeat) bannerText = 'You win the trick'
    else if (wSeat === partnerSeat) bannerText = `${nameOf(wSeat)} wins it for your team`
    else bannerText = `${nameOf(wSeat)} takes the trick`
  }
  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {!sweeping &&
          view.trick.map((entry) => (
            <PlayedCard key={entry.card.id} entry={entry} mySeat={mySeat} w={w} h={h} cw={cw} deck={deck} fromRect={fromRects.current[entry.card.id]} />
          ))}
      </AnimatePresence>
      {sweeping && (
        <>
          {sweeping.cards.map((entry, i) => (
            <SweepCard key={`sweep-${sweeping.seq}-${entry.card.id}`} entry={entry} order={i} winner={sweeping.winner} mySeat={mySeat} w={w} h={h} cw={cw} deck={deck} />
          ))}
          <WinBanner key={`banner-${sweeping.seq}`} text={bannerText} mine={sweeping.winner === mySeat || sweeping.winner === partnerSeat} top={c.y + cw * 1.4 * 0.95} />
        </>
      )}
    </div>
  )
}
