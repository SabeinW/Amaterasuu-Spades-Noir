// One playing card in the Sun & Ink style. Pure presentation: size comes
// from `width` (height is 1.4×), look from the deck theme.
import { memo } from 'react'
import Suit from './Suit'
import { DECK_THEMES } from '../../data/tableThemes'

const DEFAULT_DECK = DECK_THEMES[0]
const COURT = new Set(['J', 'Q', 'K'])

const FACE = {
  washi: { className: 'washi', ink: '#1a1714' },
  ivory: { className: '', bg: 'linear-gradient(160deg,#fffdf8 0%,#f6f0e4 60%,#ece3d2 100%)', ink: '#14110d' },
  noir: { className: '', bg: 'radial-gradient(120% 90% at 30% 0%,#2a241b 0%,#12100c 55%,#070605 100%)', ink: '#efe6d6' },
}

export function courtArt(card, deck) {
  const dir = deck?.courtSet ? `/art/court/${deck.courtSet}` : '/art/court'
  if (card.suit === 'JOKER') return `${dir}/${card.value === 'BIG' ? 'JOKER_BIG' : 'JOKER_SMALL'}.webp`
  if (COURT.has(card.value)) return `${dir}/${card.value}${card.suit}.webp`
  return null
}

function CardBack({ width, deck, style, className }) {
  const r = Math.max(4, width * 0.075)
  return (
    <div
      className={`relative shrink-0 select-none overflow-hidden ${className}`}
      style={{
        width,
        height: width * 1.4,
        borderRadius: r,
        background: `${deck.backTint} url(${deck.backImage}) center / cover no-repeat`,
        boxShadow: `0 1px 0 rgb(255 255 255 / 0.08) inset, 0 0 0 1px ${deck.edge}55, 0 6px 14px -6px rgb(0 0 0 / 0.7)`,
        ...style,
      }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgb(255 255 255 / 0.16) 0%, transparent 38%)', borderRadius: r }} />
    </div>
  )
}

function Index({ card, ink, width, flip, faceKind, onArt }) {
  const isJoker = card.suit === 'JOKER'
  const rankSize = Math.max(10, width * (card.value === '10' ? 0.23 : 0.27))
  const suitSize = Math.max(8, width * 0.17)
  return (
    <div
      className="absolute flex flex-col items-center leading-none"
      style={{
        top: flip ? undefined : width * 0.05,
        left: flip ? undefined : width * 0.05,
        bottom: flip ? width * 0.05 : undefined,
        right: flip ? width * 0.05 : undefined,
        transform: flip ? 'rotate(180deg)' : undefined,
        padding: onArt ? `${width * 0.03}px ${width * 0.025}px` : 0,
        borderRadius: width * 0.05,
        background: onArt ? (faceKind === 'noir' ? 'rgb(12 10 8 / 0.86)' : 'rgb(248 241 229 / 0.9)') : undefined,
        minWidth: width * 0.2,
      }}
    >
      {isJoker ? (
        <span
          className="font-display font-extrabold tracking-tight"
          style={{ fontSize: Math.max(8, width * 0.13), color: ink, writingMode: 'vertical-rl', letterSpacing: '0.04em' }}
        >
          JOKER
        </span>
      ) : (
        <>
          <span className="font-display font-extrabold" style={{ fontSize: rankSize, color: ink, letterSpacing: card.value === '10' ? '-0.06em' : 0 }}>
            {card.value}
          </span>
          <Suit suit={card.suit} color={ink} size={suitSize} style={{ marginTop: width * 0.015 }} />
        </>
      )}
    </div>
  )
}

function Card({ card, faceDown = false, deck = DEFAULT_DECK, width = 64, selected = false, dim = false, trumpHint = false, className = '', style, onClick, ariaLabel }) {
  if (faceDown || !card) return <CardBack width={width} deck={deck} style={style} className={className} />

  const face = FACE[deck.face] ?? FACE.washi
  const r = Math.max(4, width * 0.075)
  const isJoker = card.suit === 'JOKER'
  const ink = isJoker ? (card.value === 'BIG' ? '#c8321f' : face.ink) : deck.ink?.[card.suit] ?? face.ink
  const art = courtArt(card, deck)
  const big = card.value === 'A'
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`relative shrink-0 select-none overflow-hidden text-left ${face.className} ${className}`}
      style={{
        width,
        height: width * 1.4,
        borderRadius: r,
        background: face.bg,
        boxShadow: selected
          ? `0 0 0 2px ${'#f1d28a'}, 0 14px 28px -8px rgb(212 166 74 / 0.75), 0 2px 4px rgb(0 0 0 / 0.4)`
          : `0 0 0 1px ${deck.edge}66, 0 2px 3px rgb(0 0 0 / 0.35), 0 10px 20px -10px rgb(0 0 0 / 0.75)`,
        filter: dim ? 'brightness(0.55) saturate(0.6)' : undefined,
        transition: 'filter 180ms ease, box-shadow 180ms ease',
        ...style,
      }}
    >
      {/* fine metal inner rule */}
      <div className="absolute pointer-events-none" style={{ inset: width * 0.035, borderRadius: r * 0.7, border: `1px solid ${deck.edge}${deck.face === 'noir' ? '80' : '55'}` }} />

      {art ? (
        <div
          className="absolute overflow-hidden washi"
          style={{ inset: width * 0.06, borderRadius: r * 0.6, boxShadow: `0 0 0 1px ${deck.edge}88` }}
        >
          <img src={art} alt="" draggable={false} loading="lazy" decoding="async" className="w-full h-full object-cover" style={{ objectPosition: '50% 18%' }} />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {big && (
            <div
              className="absolute rounded-full"
              style={{
                width: width * 0.62,
                height: width * 0.62,
                background: card.suit === 'S' ? 'radial-gradient(circle at 35% 30%, #f6dc9a, #d4a64a 55%, #a37a2c 100%)' : 'transparent',
                boxShadow: card.suit === 'S' ? '0 0 0 1px rgb(138 106 43 / 0.6), 0 4px 10px -4px rgb(0 0 0 / 0.4)' : `0 0 0 1.5px ${ink}55`,
                opacity: card.suit === 'S' ? 1 : 0.9,
              }}
            />
          )}
          <Suit suit={card.suit} color={big && card.suit === 'S' ? '#14110d' : ink} size={width * (big ? 0.4 : 0.44)} style={{ position: 'relative', marginTop: width * 0.06, filter: 'drop-shadow(0 1px 0 rgb(255 255 255 / 0.25))' }} />
        </div>
      )}

      <Index card={card} ink={ink} width={width} faceKind={deck.face} onArt={!!art} />
      <Index card={card} ink={ink} width={width} faceKind={deck.face} onArt={!!art} flip />

      {trumpHint && (
        <div
          className="absolute flex items-center justify-center rounded-full"
          title="Trump (plays as a spade)"
          style={{
            left: width * 0.06,
            top: width * 0.56,
            width: Math.max(12, width * 0.2),
            height: Math.max(12, width * 0.2),
            background: 'radial-gradient(circle at 35% 30%, #fff1c9, #d4a64a 60%, #8a6a2b)',
            boxShadow: '0 1px 3px rgb(0 0 0 / 0.4)',
          }}
        >
          <Suit suit="S" color="#1b1307" size={Math.max(7, width * 0.12)} />
        </div>
      )}

      {/* lacquer sheen */}
      <div className="absolute inset-0 pointer-events-none" style={{ borderRadius: r, background: 'linear-gradient(135deg, rgb(255 255 255 / 0.22) 0%, transparent 30%, transparent 70%, rgb(0 0 0 / 0.06) 100%)' }} />
    </Tag>
  )
}

export default memo(Card)
export { CardBack }
