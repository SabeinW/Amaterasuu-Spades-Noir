// The deal: card backs fly one at a time from the dealer to each of the
// other three seats, clockwise from the dealer's left. (Your own 13 cards
// fly into your hand from the same spot — see HandFan.)
import { motion } from 'motion/react'
import { memo } from 'react'
import { CardBack } from '../cards/Card'
import { DEAL_FLIGHT, DEAL_STAGGER, seatAnchor, slotOf, tableCenter } from './geometry'

function DealLayer({ dealer, mySeat, w, h, cw, deck }) {
  const c = tableCenter(w, h)
  const from = { x: c.x - cw / 2, y: c.y - (cw * 1.4) / 2 }
  const cards = []
  for (let i = 0; i < 52; i++) {
    const seat = (dealer + 1 + i) % 4
    if (seat === mySeat) continue
    const slot = slotOf(seat, mySeat)
    const to = seatAnchor(slot, w, h, cw)
    cards.push({ i, slot, to })
  }
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
      {/* the deck itself, shrinking as it's dealt */}
      <motion.div
        className="absolute left-0 top-0"
        initial={{ x: from.x, y: from.y, scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: [0.6, 1, 1, 0.9], opacity: [0, 1, 1, 0], rotate: [-8, 0, 0, 0] }}
        transition={{ duration: (52 * DEAL_STAGGER + DEAL_FLIGHT) / 1000 + 0.1, times: [0, 0.08, 0.9, 1] }}
      >
        <CardBack width={cw} deck={deck} />
      </motion.div>
      {cards.map(({ i, slot, to }) => (
        <motion.div
          key={i}
          className="absolute left-0 top-0"
          initial={{ x: from.x, y: from.y, rotate: 0, opacity: 0, scale: 1 }}
          animate={{
            x: to.x - cw / 2,
            y: to.y - (cw * 1.4) / 2,
            rotate: slot === 'left' ? -90 + (i % 5) * 3 : slot === 'right' ? 90 - (i % 5) * 3 : 180 + (i % 5) * 2,
            opacity: [0, 1, 1, 0],
            scale: 0.62,
          }}
          transition={{ delay: (i * DEAL_STAGGER) / 1000, duration: DEAL_FLIGHT / 1000, ease: [0.22, 0.8, 0.3, 1], opacity: { times: [0, 0.1, 0.85, 1], delay: (i * DEAL_STAGGER) / 1000, duration: DEAL_FLIGHT / 1000 + 0.05 } }}
        >
          <CardBack width={cw} deck={deck} />
        </motion.div>
      ))}
    </div>
  )
}

export default memo(DealLayer)
