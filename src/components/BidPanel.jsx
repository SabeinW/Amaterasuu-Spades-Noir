import { useState } from 'react'

const NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

export default function BidPanel({ onConfirm, accentColor = '#fbbf24', maxBid = 13 }) {
  const [selected, setSelected] = useState(null)

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 top-16 md:top-20 z-30 w-[92%] max-w-sm rounded-2xl p-5 bg-slate-900/80 backdrop-blur-md border border-amber-500/30 shadow-2xl"
    >
      <p className="text-center font-display font-semibold mb-4" style={{ color: accentColor }}>
        ♠ How many tricks?
      </p>
      {maxBid < 13 && (
        <p className="text-center text-[10px] text-white/40 -mt-2 mb-3">
          Other bids already claim {13 - maxBid} tricks — the table can't bid past 13 combined
        </p>
      )}
      <div className="grid grid-cols-7 gap-1.5">
        {NUMBERS.map((n) => {
          const disabled = n > 0 && n > maxBid
          return (
            <button
              key={n}
              onClick={() => !disabled && setSelected(n)}
              disabled={disabled}
              className="aspect-square rounded-lg text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
              style={{
                background: selected === n ? accentColor : 'rgba(255,255,255,0.05)',
                color: selected === n ? '#0a0812' : 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {n === 0 ? 'Nil' : n}
            </button>
          )
        })}
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
