// Your hand: a gently arched fan. Cards fly in from the deck when dealt,
// shuffle along when one leaves, lift when selected, and can be played by a
// second tap, a click (mouse), or flicking the card up toward the table.
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Card from '../cards/Card'
import { dealArrival } from './geometry'

const FINE_POINTER = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches

export default function HandFan({
  cards,
  width: cw,
  deck,
  playable, // Set of ids that are legal right now (null = not your turn)
  faceDown = false,
  dealKey,
  dealer,
  mySeat,
  dealStartedAt,
  dealFrom, // window coords of the deck during a deal
  trumpIds,
  onPlay,
  disabled,
}) {
  const ref = useRef(null)
  const [box, setBox] = useState({ w: 360, left: 0, top: 0 })
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ w: r.width, left: r.left, top: r.top })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    if (selected && !cards.some((c) => c.id === selected)) setSelected(null)
  }, [cards, selected])
  useEffect(() => {
    if (!playable) setSelected(null)
  }, [playable])

  const n = cards.length
  const layout = useMemo(() => {
    const avail = Math.max(cw, box.w - 12)
    const step = n > 1 ? Math.min(cw * 0.62, (avail - cw) / (n - 1)) : 0
    const total = cw + step * Math.max(0, n - 1)
    const start = (box.w - total) / 2
    const mid = (n - 1) / 2
    const spread = Math.min(3, 34 / Math.max(n, 1))
    return cards.map((c, i) => {
      const d = i - mid
      return { x: start + i * step, y: d * d * 0.35 * (cw / 70), r: d * spread }
    })
  }, [cards, cw, box.w, n])

  function handleTap(card, el) {
    if (disabled || !playable) return
    if (!playable.has(card.id)) return
    if (FINE_POINTER || selected === card.id) {
      const rect = el?.getBoundingClientRect()
      onPlay(card, rect)
      setSelected(null)
    } else {
      setSelected(card.id)
    }
  }

  const ch = cw * 1.4
  const elapsed = dealStartedAt ? Date.now() - dealStartedAt : Infinity

  return (
    <div ref={ref} className="relative w-full" style={{ height: ch + 22 }}>
      {cards.map((card, i) => {
        const p = layout[i]
        const isSel = selected === card.id
        const legal = !playable || playable.has(card.id)
        const arrival = dealer !== undefined ? dealArrival(mySeat, i, dealer) : 0
        const delay = Math.max(0, arrival - DEAL_FLIGHT_MS - (Number.isFinite(elapsed) ? elapsed : arrival)) / 1000
        const dealing = dealFrom && Number.isFinite(elapsed) && elapsed < arrival + 200
        return (
          <motion.div
            key={`${dealKey}-${card.id}`}
            className="absolute top-2"
            style={{ zIndex: isSel ? 60 : i + 1, touchAction: 'none' }}
            initial={
              dealing
                ? { x: dealFrom.x - box.left - cw / 2, y: dealFrom.y - box.top - ch / 2, rotate: 180, scale: 0.6, opacity: 0 }
                : false
            }
            animate={{ x: p.x, y: p.y - (isSel ? cw * 0.3 : 0), rotate: isSel ? 0 : p.r, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, delay: dealing ? delay : 0 }}
            whileHover={FINE_POINTER && playable && legal && !disabled ? { y: p.y - cw * 0.16 } : undefined}
            drag={!FINE_POINTER && playable && legal && !disabled ? 'y' : false}
            dragSnapToOrigin
            dragElastic={0.5}
            dragConstraints={{ top: -200, bottom: 0 }}
            onDragEnd={(e, info) => {
              if (info.offset.y < -55) {
                const el = e.target?.closest?.('[data-card]')
                onPlay(card, el?.getBoundingClientRect())
              }
            }}
          >
            <div data-card onClick={(e) => handleTap(card, e.currentTarget)} style={{ cursor: playable && legal ? 'pointer' : 'default' }}>
              <Card
                card={card}
                faceDown={faceDown}
                deck={deck}
                width={cw}
                selected={isSel}
                dim={!!playable && !legal}
                trumpHint={trumpIds?.has(card.id)}
                ariaLabel={faceDown ? 'Face-down card' : `${card.value} of ${card.suit}`}
              />
            </div>
            {isSel && (
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 -top-7 text-[11px] font-bold tracking-wide whitespace-nowrap px-2 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(135deg,#f6dc9a,#d4a64a)', color: '#1b1307' }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Tap to play
              </motion.div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

const DEAL_FLIGHT_MS = 340
