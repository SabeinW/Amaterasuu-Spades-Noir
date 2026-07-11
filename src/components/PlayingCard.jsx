import { SUIT_SYMBOL } from '../lib/cards'

const NEON_RED = '#fb4f6f'
const NEON_GREEN = '#4ade80'
const CLASSIC_RED = '#dc2626'

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
  // Master/OG themes carry a `face` ('white' | 'black') for a real card-stock
  // look with a `metal` accent instead of the standard decks' dark neon-tint
  // face. `classicColors` (OG's) uses true black/red suit ink instead of the
  // app's neon red/green hearts-clubs convention. `suitInk` (Midnight family)
  // swaps just the hearts/diamonds ink for a themed accent instead of red,
  // keeping spades/clubs on the same neutral used by classicColors.
  const face = deckTheme?.face
  const metal = deckTheme?.metal ?? neon
  const classicColors = !!deckTheme?.classicColors
  const suitInk = deckTheme?.suitInk

  let suitColor
  if (isJoker) {
    suitColor = face ? metal : neon
  } else if (suitInk) {
    suitColor = suit === 'H' || suit === 'D' ? suitInk : face === 'black' ? '#e5e7eb' : '#111827'
  } else if (classicColors) {
    suitColor = suit === 'H' || suit === 'D' ? CLASSIC_RED : face === 'black' ? '#e5e7eb' : '#111827'
  } else if (face) {
    suitColor = suit === 'H' ? NEON_RED : suit === 'C' ? NEON_GREEN : metal
  } else {
    // Hearts/clubs keep their traditional red/green so suits stay instantly
    // recognizable — only spades/diamonds pick up the deck's neon accent.
    suitColor = suit === 'H' ? NEON_RED : suit === 'C' ? NEON_GREEN : neon
  }
  const inkColor = face === 'white' ? '#111827' : face === 'black' ? '#f8fafc' : '#f8fafc'

  // Layered box-shadow used on every card for real physical depth: a soft
  // outer drop shadow to lift it off the table, an inset top highlight for
  // gloss, and an inset bottom shadow so the face reads as embossed instead
  // of flat/translucent.
  function depthShadow(glowColor) {
    return [
      selected ? `0 16px 30px -8px ${glowColor}cc` : `0 8px 16px -4px rgba(0,0,0,0.55)`,
      '0 2px 5px rgba(0,0,0,0.5)',
      `0 0 ${selected ? 20 : 10}px ${glowColor}77`,
      'inset 0 1px 1px rgba(255,255,255,0.35)',
      'inset 0 -3px 6px rgba(0,0,0,0.3)',
    ].join(', ')
  }

  if (faceDown) {
    return (
      <div
        className="rounded-lg shrink-0 select-none"
        style={{
          width: w,
          height: h,
          backgroundImage: [
            `repeating-linear-gradient(45deg, ${back.from}40 0, ${back.from}40 2px, transparent 2px, transparent 8px)`,
            `linear-gradient(135deg, ${back.from} 0%, ${back.to} 70%)`,
          ].join(', '),
          border: `1.5px solid ${back.border}`,
          boxShadow: [
            '0 6px 12px -3px rgba(0,0,0,0.55)',
            '0 2px 4px rgba(0,0,0,0.4)',
            'inset 0 1px 1px rgba(255,255,255,0.25)',
            'inset 0 -3px 5px rgba(0,0,0,0.35)',
          ].join(', '),
          ...style,
        }}
      />
    )
  }

  const faceBackground = face === 'white'
    ? [
        'linear-gradient(125deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 32%)',
        `linear-gradient(155deg, #ffffff 0%, #f2f2f5 55%, #e3e3e8 100%)`,
      ]
    : face === 'black'
      ? [
          'linear-gradient(125deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 32%)',
          `linear-gradient(155deg, #1c1c1f 0%, #101012 55%, #030303 100%)`,
        ]
      : [
          'linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0) 45%)',
          `linear-gradient(160deg, ${neon}70 0%, #0e0f1a 52%, #050509 100%)`,
        ]

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="relative rounded-lg shrink-0 select-none flex flex-col items-center justify-between p-1.5 overflow-hidden transition-transform duration-150"
      style={{
        width: w,
        height: h,
        backgroundImage: faceBackground.join(', '),
        border: selected ? `2px solid ${accentColor}` : `1.5px solid ${face ? metal : neon}`,
        boxShadow: depthShadow(selected ? accentColor : face ? metal : neon),
        transform: selected ? 'translateY(-16px)' : 'translateY(0)',
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {isJoker ? (
        <>
          <span
            className="self-start font-extrabold text-[8px] leading-none tracking-wide"
            style={{ color: face ? metal : '#f5d90a', textShadow: face ? 'none' : '0 0 6px #f5d90aaa' }}
          >
            {value === 'BIG' ? 'BIG' : 'LTL'}
          </span>
          <div className="relative flex flex-1 flex-col items-center justify-center w-full">
            <div
              className="absolute inset-1 rounded-md"
              style={{ background: 'conic-gradient(from 180deg, #a78bfa, #38bdf8, #4ade80, #f5d90a, #fb4f6f, #a78bfa)', opacity: face ? 0.35 : 0.55, filter: 'blur(2px)' }}
            />
            <span className="relative" style={{ fontSize: font * 1.35, filter: `drop-shadow(0 0 4px ${face ? metal : neon})` }}>🃏</span>
          </div>
          <span
            className="self-end font-extrabold text-[8px] leading-none tracking-wide rotate-180"
            style={{ color: face ? metal : '#f5d90a', textShadow: face ? 'none' : '0 0 6px #f5d90aaa' }}
          >
            {value === 'BIG' ? 'BIG' : 'LTL'}
          </span>
        </>
      ) : (
        <>
          <span
            className="self-start font-bold leading-none"
            style={{ fontSize: font, color: inkColor, textShadow: face ? 'none' : `0 0 6px ${suitColor}99` }}
          >
            {value}
          </span>
          <span style={{ fontSize: font * 1.3, color: suitColor, filter: face ? `drop-shadow(0 1px 1px rgba(0,0,0,0.25))` : `drop-shadow(0 0 5px ${suitColor}aa)` }}>{SUIT_SYMBOL[suit]}</span>
          <span
            className="self-end font-bold leading-none rotate-180"
            style={{ fontSize: font, color: inkColor, textShadow: face ? 'none' : `0 0 6px ${suitColor}99` }}
          >
            {value}
          </span>
        </>
      )}
    </button>
  )
}
