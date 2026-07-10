import { useEffect, useState } from 'react'

const TARGET_OFFSET = {
  bottom: { x: 0, y: 160 },
  top: { x: 0, y: -160 },
  left: { x: -160, y: 0 },
  right: { x: 160, y: 0 },
}

const ORDER = ['bottom', 'left', 'top', 'right']

export default function DealingAnimationV2({ onComplete, accentColor = '#a78bfa' }) {
  const [cards, setCards] = useState([])

  useEffect(() => {
    const list = []
    for (let round = 0; round < 13; round++) {
      for (const pos of ORDER) {
        list.push({ pos, delay: (round * 4 + ORDER.indexOf(pos)) * 80 })
      }
    }
    setCards(list)
    const timer = setTimeout(() => onComplete?.(), 4500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
      {cards.map((c, i) => {
        const { x, y } = TARGET_OFFSET[c.pos]
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-md"
            style={{
              width: 30,
              height: 42,
              marginLeft: -15,
              marginTop: -21,
              background: `linear-gradient(135deg, ${accentColor}66, #0b0715 70%)`,
              border: `1px solid ${accentColor}66`,
              boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
              '--tx': `${x}px`,
              '--ty': `${y}px`,
              animation: `cardToTrick 0.5s ease-out ${c.delay}ms both`,
            }}
          />
        )
      })}
      <p
        className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs tracking-widest uppercase animate-fadeIn"
        style={{ color: accentColor, animationDelay: '0.6s' }}
      >
        Shuffling &amp; dealing…
      </p>
    </div>
  )
}
