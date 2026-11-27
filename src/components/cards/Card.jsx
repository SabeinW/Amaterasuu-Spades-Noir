// One playing card. Pure presentation: size comes from `width` (height is
// 1.4×); the look comes from the deck theme and its card family (see
// data/cardFamilies.js): paper, metal trim, illustrated court + Ace of
// Spades, number-card emblem or classic pips, and a living effect on the
// picture cards.
import { memo, useState } from 'react'
import Suit from './Suit'
import Motif from './Motif'
import CardFx from './CardFx'
import { ALL_DECKS } from '../../data/tableThemes'
import { courtImage, familyOf } from '../../data/cardFamilies'
import { useSkinTone } from '../../lib/skinTone'

const DEFAULT_DECK = ALL_DECKS[0]

const NOIR_FACE = 'radial-gradient(120% 90% at 30% 0%,#2a241b 0%,#12100c 55%,#070605 100%)'

// Classic pip positions (x%, y%) for 2–10; pips below the middle are flipped.
const PIPS = {
  2: [[50, 18], [50, 82]],
  3: [[50, 18], [50, 50], [50, 82]],
  4: [[30, 18], [70, 18], [30, 82], [70, 82]],
  5: [[30, 18], [70, 18], [50, 50], [30, 82], [70, 82]],
  6: [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82], [70, 82]],
  7: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82], [70, 82]],
  8: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66], [30, 82], [70, 82]],
  9: [[30, 16], [70, 16], [30, 38], [70, 38], [50, 50], [30, 62], [70, 62], [30, 84], [70, 84]],
  10: [[30, 16], [70, 16], [50, 27], [30, 38], [70, 38], [30, 62], [70, 62], [50, 73], [30, 84], [70, 84]],
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

function Index({ card, ink, width, flip, noir, onArt, classic, pillBg, ring }) {
  const isJoker = card.suit === 'JOKER'
  const rankSize = Math.max(10, width * (card.value === '10' ? 0.23 : 0.27))
  const suitSize = Math.max(8, width * 0.17)
  return (
    <div
      className="absolute flex flex-col items-center leading-none"
      style={{
        zIndex: 4,
        top: flip ? undefined : width * 0.05,
        left: flip ? undefined : width * 0.05,
        bottom: flip ? width * 0.05 : undefined,
        right: flip ? width * 0.05 : undefined,
        transform: flip ? 'rotate(180deg)' : undefined,
        padding: onArt ? `${width * 0.03}px ${width * 0.025}px` : 0,
        borderRadius: width * 0.05,
        background: onArt ? pillBg ?? (noir ? 'rgb(12 10 8 / 0.86)' : 'rgb(250 245 235 / 0.92)') : undefined,
        boxShadow: onArt ? `0 1px 3px rgb(0 0 0 / 0.25)${ring ? `, inset 0 0 0 1px ${ring}` : ''}` : undefined,
        minWidth: width * 0.2,
      }}
    >
      {isJoker ? (
        // Two short columns, read top to bottom: "BIG / JOKER" or "LITTLE /
        // JOKER". One long line would not fit down the card's edge, and the
        // edge is all you see of a card in a fanned hand.
        // The outer size sets each column's minimum width, so it stays small.
        <span className="font-display font-extrabold" style={{ color: ink, writingMode: 'vertical-rl', letterSpacing: '0.02em', lineHeight: 1.05, fontSize: Math.max(6, width * 0.08) }}>
          <span style={{ fontSize: Math.max(7, width * 0.1) }}>{card.value === 'BIG' ? 'BIG' : 'LITTLE'}</span>
          <br />
          JOKER
        </span>
      ) : (
        <>
          <span
            className={classic ? 'font-extrabold' : 'font-display font-extrabold'}
            style={{ fontSize: rankSize, color: ink, letterSpacing: card.value === '10' ? '-0.06em' : 0, fontFamily: classic ? 'Georgia, "Times New Roman", serif' : undefined }}
          >
            {card.value}
          </span>
          <Suit suit={card.suit} color={ink} size={suitSize} style={{ marginTop: width * 0.015 }} />
        </>
      )}
    </div>
  )
}

function Card({ card, faceDown = false, deck = DEFAULT_DECK, width = 64, selected = false, dim = false, trumpHint = false, className = '', style, onClick, ariaLabel, still = false, eager = false, thumb = false }) {
  // A painting that won't load gets one retry before the card falls back to its
  // plain design, so a dropped request on a phone doesn't leave a court empty.
  // A missing skin-tone copy falls back to the original painting first.
  const [miss, setMiss] = useState({ src: null, tries: 0 })
  const tone = useSkinTone()
  if (faceDown || !card) return <CardBack width={width} deck={deck} style={style} className={className} />

  const fam = familyOf(deck)
  const noir = deck.face === 'noir'
  const r = Math.max(4, width * 0.075)
  const isJoker = card.suit === 'JOKER'
  const faceInk = noir ? '#efe6d6' : '#1a1714'
  const ink = isJoker ? (card.value === 'BIG' ? '#c8321f' : faceInk) : deck.ink?.[card.suit] ?? faceInk
  const metal = deck.edge ?? fam.metal
  const wanted = courtImage(fam, card, { thumb, tone })
  const original = courtImage(fam, card, { thumb })
  const tries = miss.src === wanted ? miss.tries : 0
  const retry = (u) => `${u}${u.includes('?') ? '&' : '?'}retry=1`
  const sources = !wanted ? [] : wanted === original ? [wanted, retry(wanted)] : [wanted, original, retry(original)]
  const artSrc = sources[tries] ?? null
  const art = artSrc && artSrc.split('?')[0]
  const onArtError = (e) => {
    // Ignore errors from a picture this card has since swapped away from.
    if (!art || !e.currentTarget.src.includes(art)) return
    setMiss({ src: wanted, tries: tries + 1 })
  }
  // Decks with their own lettering (Mythic) put the rank on a coloured label
  // on painted cards: Big Joker in the red-suit colour, Small in the black.
  const pill = art && deck.pill
  const labelInk = pill ? pill.ink[isJoker ? (card.value === 'BIG' ? 'H' : 'S') : card.suit] : ink
  const pillBg = pill ? pill.bg : undefined
  const pillRing = pill ? `${metal}99` : undefined
  const isAce = card.value === 'A'
  const n = Number(card.value)
  const Tag = onClick ? 'button' : 'div'
  const pipLayout = fam.pips && PIPS[n]
  const living = !still && art && fam.effect && width >= 40

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`relative shrink-0 select-none overflow-hidden text-left ${className}`}
      style={{
        width,
        height: width * 1.4,
        borderRadius: r,
        background: noir ? NOIR_FACE : fam.paper,
        boxShadow: selected
          ? '0 0 0 2px #f1d28a, 0 14px 28px -8px rgb(212 166 74 / 0.75), 0 2px 4px rgb(0 0 0 / 0.4)'
          : `0 0 0 1px ${metal}66, 0 2px 3px rgb(0 0 0 / 0.35), 0 10px 20px -10px rgb(0 0 0 / 0.75)`,
        filter: dim ? 'brightness(0.55) saturate(0.6)' : undefined,
        transition: 'filter 180ms ease, box-shadow 180ms ease',
        ...style,
      }}
    >
      {/* paper grain on light stock */}
      {!noir && <div className="absolute inset-0 washi opacity-40 mix-blend-multiply pointer-events-none" />}
      {/* fine metal inner rule (double on classic) */}
      <div className="absolute pointer-events-none" style={{ inset: width * 0.035, borderRadius: r * 0.7, border: `1px solid ${metal}${noir ? '90' : '70'}` }} />
      {fam.pips && <div className="absolute pointer-events-none" style={{ inset: width * 0.055, borderRadius: r * 0.55, border: `1px solid ${metal}40` }} />}

      {art ? (
        <div className="absolute overflow-hidden" style={{ inset: width * 0.06, borderRadius: r * 0.6, boxShadow: `0 0 0 1px ${metal}99`, background: fam.paper }}>
          <img
            src={artSrc}
            alt=""
            draggable={false}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={onArtError}
            className="w-full h-full object-cover"
            style={{ objectPosition: card.value === 'A' ? '50% 50%' : '50% 18%' }}
          />
          {living && <CardFx effect={fam.effect} id={`${deck.id}-${card.id}`} radius={r * 0.6} />}
        </div>
      ) : pipLayout ? (
        <div className="absolute" style={{ inset: `${width * 0.12}px ${width * 0.2}px` }}>
          {pipLayout.map(([x, y], i) => (
            <Suit
              key={i}
              suit={card.suit}
              color={ink}
              size={width * 0.17}
              style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%)${y > 50 ? ' rotate(180deg)' : ''}` }}
            />
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {fam.motif && <Motif motif={fam.motif} color={noir ? metal : fam.metal} size={width * (isAce ? 0.86 : 0.78)} opacity={noir ? 0.4 : isAce ? 0.36 : 0.3} />}
          {isAce && (
            <div className="absolute rounded-full" style={{ width: width * 0.62, height: width * 0.62, boxShadow: `0 0 0 1.5px ${ink}55` }} />
          )}
          <Suit suit={card.suit} color={ink} metal={metal} size={width * (isAce ? 0.4 : 0.44)} style={{ position: 'relative', marginTop: width * 0.06, filter: 'drop-shadow(0 1px 0 rgb(255 255 255 / 0.25))' }} />
        </div>
      )}

      <Index card={card} ink={labelInk} width={width} noir={noir} onArt={!!art} classic={fam.pips} pillBg={pillBg} ring={pillRing} />
      <Index card={card} ink={labelInk} width={width} noir={noir} onArt={!!art} classic={fam.pips} pillBg={pillBg} ring={pillRing} flip />

      {trumpHint && (
        <div
          className="absolute flex items-center justify-center rounded-full"
          title="Trump (plays as a spade)"
          style={{
            zIndex: 5,
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
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 6, borderRadius: r, background: 'linear-gradient(135deg, rgb(255 255 255 / 0.22) 0%, transparent 30%, transparent 70%, rgb(0 0 0 / 0.06) 100%)' }} />
    </Tag>
  )
}

export default memo(Card)
export { CardBack }
