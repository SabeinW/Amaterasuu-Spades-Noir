// Family emblem drawn faintly behind a number card's big suit, so a 7♦
// from the Tide deck reads differently from a 7♦ from the Ember deck.
const PATHS = {
  sun: (
    <>
      <circle cx="50" cy="50" r="17" />
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8
        return <line key={i} x1={50 + Math.cos(a) * 24} y1={50 + Math.sin(a) * 24} x2={50 + Math.cos(a) * (i % 2 ? 38 : 46)} y2={50 + Math.sin(a) * (i % 2 ? 38 : 46)} strokeWidth="2.2" />
      })}
    </>
  ),
  moon: (
    <>
      <path d="M62 12a38 38 0 1 0 26 52A30 30 0 1 1 62 12z" />
      <circle cx="22" cy="20" r="1.8" />
      <circle cx="84" cy="28" r="1.4" />
      <circle cx="78" cy="84" r="1.6" />
    </>
  ),
  flame: <path d="M50 6c6 16 22 24 22 46 0 16-10 30-22 30S28 68 28 52c0-12 8-18 10-28 6 8 4 16 10 20 0-14 2-26 2-38zm0 50c-4 6-8 10-8 16 0 6 4 10 8 10s8-4 8-10c0-6-4-10-8-16z" />,
  wave: (
    <>
      <path d="M6 62c10-18 28-26 44-22-10 4-14 12-12 20 6-10 20-14 32-8 8 4 14 12 24 10-8 10-22 12-32 6-6 8-20 12-32 8S8 70 6 62z" />
      <path d="M10 82c14 6 26-6 40 0s26-6 40 0" fill="none" strokeWidth="3" />
    </>
  ),
  snow: (
    <g strokeWidth="3" strokeLinecap="round">
      {[0, 60, 120].map((r) => (
        <g key={r} transform={`rotate(${r} 50 50)`}>
          <line x1="50" y1="8" x2="50" y2="92" />
          <line x1="50" y1="22" x2="40" y2="14" />
          <line x1="50" y1="22" x2="60" y2="14" />
          <line x1="50" y1="78" x2="40" y2="86" />
          <line x1="50" y1="78" x2="60" y2="86" />
        </g>
      ))}
    </g>
  ),
  leaf: (
    <>
      <path d="M50 90C26 70 20 40 50 8c30 32 24 62 0 82z" />
      <path d="M50 88V18" fill="none" strokeWidth="2.5" />
    </>
  ),
  blossom: (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse key={i} cx="50" cy="28" rx="13" ry="20" transform={`rotate(${i * 72} 50 50)`} />
      ))}
      <circle cx="50" cy="50" r="8" />
    </>
  ),
  bolt: <path d="M58 4L22 56h22l-8 40 40-56H52z" />,
  eclipse: (
    <>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12
        return <line key={i} x1={50 + Math.cos(a) * 30} y1={50 + Math.sin(a) * 30} x2={50 + Math.cos(a) * (i % 2 ? 40 : 47)} y2={50 + Math.sin(a) * (i % 2 ? 40 : 47)} strokeWidth="2" />
      })}
      <circle cx="50" cy="50" r="26" fill="none" strokeWidth="5" />
    </>
  ),
  aurora: (
    <g fill="none" strokeWidth="5" strokeLinecap="round">
      <path d="M8 40c16-20 30 12 46-8s26-14 38 4" />
      <path d="M8 58c16-20 30 12 46-8s26-14 38 4" opacity="0.7" />
      <path d="M8 76c16-20 30 12 46-8s26-14 38 4" opacity="0.45" />
    </g>
  ),
  star: (
    <>
      <path d="M50 10l10 28h30L66 56l9 30-25-18-25 18 9-30-24-18h30z" />
      <circle cx="16" cy="18" r="2" />
      <circle cx="86" cy="80" r="2" />
    </>
  ),
  dune: (
    <>
      <circle cx="66" cy="30" r="12" />
      <path d="M4 74c18-18 34-18 48-6s28 10 44-6v34H4z" />
      <path d="M4 88c20-12 40-10 56 0" fill="none" strokeWidth="3" />
    </>
  ),
  drip: (
    <>
      <path d="M18 58L24 24l16 18 10-26 10 26 16-18 6 34z" />
      <rect x="18" y="58" width="64" height="7" />
      <path d="M28 65h6v11a3 3 0 0 1-6 0zM47 65h6v20a3 3 0 0 1-6 0zM66 65h6v8a3 3 0 0 1-6 0z" />
    </>
  ),
  crown: (
    <>
      <path d="M16 72l6-42 16 20 12-28 12 28 16-20 6 42z" />
      <rect x="16" y="76" width="68" height="8" rx="2" />
      <circle cx="22" cy="26" r="4" />
      <circle cx="50" cy="18" r="4" />
      <circle cx="78" cy="26" r="4" />
    </>
  ),
  burst: <path d="M50.0 6.0 L56.5 21.7 L69.1 10.4 L68.1 27.3 L84.4 22.6 L76.1 37.4 L92.9 40.2 L79.0 50.0 L92.9 59.8 L76.1 62.6 L84.4 77.4 L68.1 72.7 L69.1 89.6 L56.5 78.3 L50.0 94.0 L43.5 78.3 L30.9 89.6 L31.9 72.7 L15.6 77.4 L23.9 62.6 L7.1 59.8 L21.0 50.0 L7.1 40.2 L23.9 37.4 L15.6 22.6 L31.9 27.3 L30.9 10.4 L43.5 21.7Z" />,
  mask: <path fillRule="evenodd" d="M8 42c10-10 26-12 42-4 16-8 32-6 42 4-2 14-12 24-26 24-8 0-12-6-16-10-4 4-8 10-16 10-14 0-24-10-26-24zM24 44c6-4 13-3 17 2-4 6-13 6-17-2zM59 46c4-5 11-6 17-2-4 8-13 8-17 2z" />,
  cloud: (
    <>
      <path d="M28 62a16 16 0 0 1 2-32 22 22 0 0 1 42-6 16 16 0 0 1 14 30 14 14 0 0 1-10 8H28z" />
      <path d="M54 58L44 76h9l-7 18 18-24h-9l6-12z" />
    </>
  ),
}

export default function Motif({ motif, color, size, opacity = 0.16 }) {
  const art = PATHS[motif]
  if (!art) return null
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ position: 'absolute', opacity }} fill={color} stroke={color}>
      {art}
    </svg>
  )
}
