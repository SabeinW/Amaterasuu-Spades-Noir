// The cards in the middle of the table: each one flies in from the seat
// that played it, and a finished trick glows on its winner's card, then
// sweeps off to the winner's seat.
import { AnimatePresence, motion } from 'motion/react'
import Card from '../cards/Card'
import { jitter, seatAnchor, slotOf, tableCenter, trickSlot } from './geometry'

function TrickCard({ entry, mySeat, w, h, cw, deck, fromRect, winner, sweepTo, delay = 0 }) {
  const slot = slotOf(entry.seat, mySeat)
  const c = tableCenter(w, h)
  const s = trickSlot(slot, cw)
  const rest = { x: c.x + s.x - cw / 2, y: c.y + s.y - (cw * 1.4) / 2, rotate: s.r + jitter(entry.card.id, 7) }
  const from = fromRect ?? seatAnchor(slot, w, h, cw)
  const fromPos = { x: from.x - cw / 2, y: from.y - (cw * 1.4) / 2 }
  const isWinner = winner !== undefined && entry.seat === winner

  return (
    <motion.div
      className="absolute left-0 top-0"
      style={{ zIndex: isWinner ? 30 : 20 }}
      initial={sweepTo ? false : { x: fromPos.x, y: fromPos.y, rotate: slot === 'left' ? -40 : slot === 'right' ? 40 : jitter(entry.card.id, 20), scale: slot === 'bottom' ? 1.25 : 0.7, opacity: 0.4 }}
      animate={
        sweepTo
          ? {
              x: [rest.x, rest.x, sweepTo.x - cw / 2],
              y: [rest.y, rest.y - (isWinner ? 6 : 0), sweepTo.y - (cw * 1.4) / 2],
              rotate: [rest.rotate, rest.rotate, rest.rotate + 25],
              scale: [1, isWinner ? 1.08 : 1, 0.45],
              opacity: [1, 1, 0],
            }
          : { ...rest, scale: 1, opacity: 1 }
      }
      transition={
        sweepTo
          ? { duration: 1.15, times: [0, 0.55, 1], ease: ['linear', [0.55, 0, 0.75, 0.3]], delay }
          : { type: 'spring', stiffness: 320, damping: 26, mass: 0.8 }
      }
    >
      <div style={{ borderRadius: cw * 0.08, boxShadow: isWinner ? '0 0 0 2px #f1d28a, 0 0 26px 4px rgb(241 210 138 / 0.55)' : undefined, transition: 'box-shadow 250ms ease' }}>
        <Card card={entry.card} deck={deck} width={cw} />
      </div>
    </motion.div>
  )
}

export default function TrickArea({ view, event, mySeat, w, h, cw, deck, fromRects }) {
  if (!view || !w) return null
  const sweeping = event?.t === 'trick' ? event : null
  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {!sweeping &&
          view.trick.map((entry) => (
            <TrickCard key={entry.card.id} entry={entry} mySeat={mySeat} w={w} h={h} cw={cw} deck={deck} fromRect={fromRects.current[entry.card.id]} />
          ))}
      </AnimatePresence>
      {sweeping &&
        sweeping.cards.map((entry) => (
          <TrickCard
            key={`sweep-${sweeping.seq}-${entry.card.id}`}
            entry={entry}
            mySeat={mySeat}
            w={w}
            h={h}
            cw={cw}
            deck={deck}
            winner={sweeping.winner}
            sweepTo={seatAnchor(slotOf(sweeping.winner, mySeat), w, h, cw)}
          />
        ))}
    </div>
  )
}
