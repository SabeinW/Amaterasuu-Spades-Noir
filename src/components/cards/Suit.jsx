// The suit marks, drawn as SVG (Unicode ♥♦ render as emoji on some phones).
// Spade and club have flared stems with a curled foot, the diamond has
// curved-in sides, and the heart is full with a long point. Big marks (the
// centre of number cards and Aces) also get an inlaid line in the deck's trim
// colour; small marks (corners, pips) stay plain so they read at a glance.

const STEM = 'M47 56C47 76 43 87 31 95Q50 90.5 69 95C57 87 53 76 53 56Z'
const SHAPES = {
  S: [['path', { d: 'M50 3C53 13 63 23 76 33C88 42 95 50 95 61C95 73 86 81 75 81C66 81 59 77 55 71L45 71C41 77 34 81 25 81C14 81 5 73 5 61C5 50 12 42 24 33C37 23 47 13 50 3Z' }], ['path', { d: STEM }]],
  H: [['path', { d: 'M50 95C45 85 32 74 21 62C11 51 4 41 4 30C4 16 15 6 28 6C38 6 46 12 50 21C54 12 62 6 72 6C85 6 96 16 96 30C96 41 89 51 79 62C68 74 55 85 50 95Z' }]],
  D: [['path', { d: 'M50 2C57 20 70 36 87 50C70 64 57 80 50 98C43 80 30 64 13 50C30 36 43 20 50 2Z' }]],
  C: [['circle', { cx: 50, cy: 27, r: 19 }], ['circle', { cx: 28.5, cy: 56, r: 19 }], ['circle', { cx: 71.5, cy: 56, r: 19 }], ['path', { d: 'M50 34L33 62L67 62Z' }], ['path', { d: STEM }]],
}

const INLAY_MIN = 22 // px: below this the line would be a blur
// The line is the gap between two shrunken copies of the shape.
const CENTRE = { S: [50, 47], H: [50, 46], D: [50, 50], C: [50, 52] }
const OUTER = 0.8
const INNER = 0.72

const rgb = (h) => {
  const m = /^#([0-9a-f]{6})$/i.exec(h ?? '')
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const lum = (c) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// The trim colour when it stands out from the mark; otherwise (a deck whose
// trim matches its hearts, a dark deck with pale marks) a tint of the mark
// itself: lighter on dark marks, darker on light ones.
function inlayColour(color, metal) {
  const c = rgb(color)
  if (!c) return 'rgb(255 255 255 / 0.55)'
  const m = rgb(metal)
  if (m && contrast(c, m) >= 1.8) return metal
  const toward = lum(c) < 0.3 ? 255 : 0
  const t = toward ? 0.55 : 0.45
  return `rgb(${c.map((v) => Math.round(v + (toward - v) * t)).join(' ')})`
}

function Parts({ suit, fill, scale = 1 }) {
  const [x, y] = CENTRE[suit]
  const parts = SHAPES[suit].map(([Tag, attrs], i) => <Tag key={i} {...attrs} fill={fill} />)
  if (scale === 1) return parts
  return <g transform={`translate(${x} ${y}) scale(${scale}) translate(${-x} ${-y})`}>{parts}</g>
}

export default function Suit({ suit, color = 'currentColor', size = 16, metal, className = '', style }) {
  if (!SHAPES[suit]) return null
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden="true">
      <Parts suit={suit} fill={color} />
      {size >= INLAY_MIN && (
        <>
          <Parts suit={suit} fill={inlayColour(color, metal)} scale={OUTER} />
          <Parts suit={suit} fill={color} scale={INNER} />
        </>
      )}
    </svg>
  )
}

export const SUIT_NAME = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }
