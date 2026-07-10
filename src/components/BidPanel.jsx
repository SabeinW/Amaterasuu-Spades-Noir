import { useState } from 'react'

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

export default function BidPanel({ onConfirm, accentColor = '#fbbf24' }) {
  const [selected, setSelected] = useState(null)

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 top-16 md:top-20 z-30 w-[92%] max-w-sm rounded-2xl p-5 backdrop-blur-xl"
      style={{
        background: 'rgba(10,8,18,0.82)',
        border: `1px solid ${accentColor}88`,
        boxShadow: `0 0 30px ${accentColor}33`,
      }}
    >
      <p className="text-center font-display font-semibold mb-4" style={{ color: accentColor }}>
        ♠ How many tricks?
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {NUMBERS.map((n) => (
          <button
            key={n}
            onClick={() => setSelected(n)}
            className="aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-colors"
            style={{
              background: selected === n ? accentColor : 'rgba(255,255,255,0.05)',
              color: selected === n ? '#0a0812' : 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {n === 0 ? 'Nil' : n}
          </button>
        ))}
      </div>
      <button
        disabled={selected === null}
        onClick={() => onConfirm(selected)}
        className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-30 transition-opacity"
        style={{ background: selected === null ? 'rgba(255,255,255,0.08)' : accentColor, color: selected === null ? 'rgba(255,255,255,0.4)' : '#0a0812' }}
      >
        {selected === null ? 'Tap a number above' : `Confirm bid: ${selected === 0 ? 'Nil' : selected}`}
      </button>
    </div>
  )
}
