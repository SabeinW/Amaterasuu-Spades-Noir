import { SUIT_SYMBOL } from '../lib/cards'

const RED_SUITS = new Set(['H', 'D'])

export default function PlayingCard({ suit, value, selected = false, faceDown = false, disabled = false, size = 'md', accentColor = '#a78bfa', deckTheme, style, onClick }) {
  const sizes = {
    sm: { w: 40, h: 56, font: 12 },
    md: { w: 56, h: 78, font: 15 },
    lg: { w: 72, h: 100, font: 18 },
  }
  const { w, h, font } = sizes[size] ?? sizes.md
  const isJoker = suit === 'JOKER'
  const isRed = RED_SUITS.has(suit)
  const back = deckTheme?.back ?? { from: `${accentColor}`, to: '#0b0715', border: `${accentColor}66` }
  const faceBg = deckTheme?.faceBg ?? '#f5f3ee'

  if (faceDown) {
    return (
      <div
        className="rounded-lg shrink-0 select-none"
        style={{
          width: w,
          height: h,
          background: `linear-gradient(135deg, ${back.from}, ${back.to} 70%)`,
          border: `1px solid ${back.border}`,
          boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
          backgroundImage:
            `repeating-linear-gradient(45deg, ${back.from}33 0, ${back.from}33 2px, transparent 2px, transparent 8px)`,
          ...style,
        }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="rounded-lg shrink-0 select-none flex flex-col items-center justify-between p-1.5 transition-transform duration-150"
      style={{
        width: w,
        height: h,
        background: faceBg,
        border: selected ? `2px solid ${accentColor}` : '1px solid rgba(0,0,0,0.15)',
        boxShadow: selected ? `0 12px 24px -8px ${accentColor}aa, 0 0 0 1px ${accentColor}` : '0 3px 8px rgba(0,0,0,0.35)',
        transform: selected ? 'translateY(-16px)' : 'translateY(0)',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {isJoker ? (
        <div className="flex flex-1 flex-col items-center justify-center text-black">
          <span style={{ fontSize: font }}>🃏</span>
          <span className="text-[8px] font-bold tracking-wide">{value === 'BIG' ? 'BIG' : 'SM'}</span>
        </div>
      ) : (
        <>
          <span
            className="self-start font-bold leading-none"
            style={{ fontSize: font, color: isRed ? '#dc2626' : '#111827' }}
          >
            {value}
          </span>
          <span style={{ fontSize: font * 1.3, color: isRed ? '#dc2626' : '#111827' }}>{SUIT_SYMBOL[suit]}</span>
          <span
            className="self-end font-bold leading-none rotate-180"
            style={{ fontSize: font, color: isRed ? '#dc2626' : '#111827' }}
          >
            {value}
          </span>
        </>
      )}
    </button>
  )
}
