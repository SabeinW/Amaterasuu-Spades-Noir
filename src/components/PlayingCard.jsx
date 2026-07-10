import { SUIT_SYMBOL } from '../lib/cards'

const NEON_RED = '#fb4f6f'
const NEON_GREEN = '#4ade80'

export default function PlayingCard({ suit, value, selected = false, faceDown = false, disabled = false, size = 'md', accentColor = '#a78bfa', deckTheme, style, onClick }) {
  const sizes = {
    sm: { w: 40, h: 56, font: 12 },
    md: { w: 56, h: 78, font: 15 },
    lg: { w: 72, h: 100, font: 18 },
  }
  const { w, h, font } = sizes[size] ?? sizes.md
  const isJoker = suit === 'JOKER'
  const back = deckTheme?.back ?? { from: `${accentColor}`, to: '#0b0715', border: `${accentColor}66` }
  const neon = back.from
  // Hearts/clubs keep their traditional red/green so suits stay instantly
  // recognizable — only spades/diamonds pick up the deck's neon accent.
  const suitColor = isJoker ? neon : suit === 'H' ? NEON_RED : suit === 'C' ? NEON_GREEN : neon

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
      className="relative rounded-lg shrink-0 select-none flex flex-col items-center justify-between p-1.5 overflow-hidden transition-transform duration-150"
      style={{
        width: w,
        height: h,
        background: `linear-gradient(160deg, ${neon}3d 0%, #0c0d16 52%, #050509 100%)`,
        backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 45%)`,
        border: selected ? `2px solid ${accentColor}` : `1.5px solid ${neon}`,
        boxShadow: selected
          ? `0 12px 26px -8px ${accentColor}cc, 0 0 0 1px ${accentColor}, 0 0 16px ${accentColor}99`
          : `0 0 10px ${neon}66, 0 3px 10px rgba(0,0,0,0.55), inset 0 0 14px ${neon}22`,
        transform: selected ? 'translateY(-16px)' : 'translateY(0)',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {isJoker ? (
        <div className="relative flex flex-1 flex-col items-center justify-center w-full">
          <div
            className="absolute inset-1 rounded-md"
            style={{ background: 'conic-gradient(from 180deg, #a78bfa, #38bdf8, #4ade80, #f5d90a, #fb4f6f, #a78bfa)', opacity: 0.35, filter: 'blur(3px)' }}
          />
          <span className="relative" style={{ fontSize: font * 1.35, filter: `drop-shadow(0 0 4px ${neon})` }}>🃏</span>
          <span className="relative text-[8px] font-extrabold tracking-wide text-center leading-tight" style={{ color: '#f5d90a', textShadow: '0 0 6px #f5d90aaa' }}>
            {value === 'BIG' ? 'BIG' : 'LITTLE'}
          </span>
        </div>
      ) : (
        <>
          <span
            className="self-start font-bold leading-none"
            style={{ fontSize: font, color: '#f8fafc', textShadow: `0 0 6px ${suitColor}99` }}
          >
            {value}
          </span>
          <span style={{ fontSize: font * 1.3, color: suitColor, filter: `drop-shadow(0 0 5px ${suitColor}aa)` }}>{SUIT_SYMBOL[suit]}</span>
          <span
            className="self-end font-bold leading-none rotate-180"
            style={{ fontSize: font, color: '#f8fafc', textShadow: `0 0 6px ${suitColor}99` }}
          >
            {value}
          </span>
        </>
      )}
    </button>
  )
}
