// Crisp SVG suit marks (Unicode ♥♦ render as emoji on some phones).
const PATHS = {
  S: 'M50 4C38 22 8 38 8 62c0 14 11 24 24 24 7 0 12-3 15-7-1 8-4 14-10 18h26c-6-4-9-10-10-18 3 4 8 7 15 7 13 0 24-10 24-24C92 38 62 22 50 4z',
  H: 'M50 92C36 78 6 58 6 34 6 18 18 8 31 8c8 0 15 4 19 11 4-7 11-11 19-11 13 0 25 10 25 26 0 24-30 44-44 58z',
  D: 'M50 4L86 50 50 96 14 50z',
  C: 'M50 6c-12 0-21 9-21 20 0 5 2 10 5 13-3-1-6-2-9-2-12 0-21 9-21 20s9 21 21 21c9 0 16-5 19-12-1 9-4 16-11 22h34c-7-6-10-13-11-22 3 7 10 12 19 12 12 0 21-9 21-21s-9-20-21-20c-3 0-6 1-9 2 3-3 5-8 5-13 0-11-9-20-21-20z',
}

export default function Suit({ suit, color = 'currentColor', size = 16, className = '', style }) {
  const d = PATHS[suit]
  if (!d) return null
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} style={style} aria-hidden="true">
      <path d={d} fill={color} />
    </svg>
  )
}

export const SUIT_NAME = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }
