// Living finishes for picture cards, Aces and Jokers: lightning that
// flashes, sparks that rise, frost that glints, petals that drift… Pure CSS
// (transform/opacity) so a full hand stays smooth on phones; the keyframes
// live in index.css (.fx-*). Each card gets its own phase so a hand doesn't
// pulse in unison. Reduced-motion users get the still card.
import { memo } from 'react'

function seed(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    return (h % 10000) / 10000
  }
}

const PARTICLES = { moon: 5, ember: 7, frost: 6, bloom: 5, starfall: 6, dune: 7, cloud: 4, storm: 1, aurora: 0, tide: 0, gold: 0, jade: 0, eclipse: 0 }

function CardFx({ effect, id, radius }) {
  if (!effect) return null
  const rnd = seed(id)
  const phase = -(rnd() * 8).toFixed(2)
  const n = PARTICLES[effect] ?? 0
  return (
    <div className={`fx-layer fx-${effect}`} style={{ borderRadius: radius, '--fx-phase': `${phase}s` }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="fx-p"
          style={{
            '--x': `${(rnd() * 90 + 5).toFixed(1)}%`,
            '--y': `${(rnd() * 80 + 10).toFixed(1)}%`,
            '--d': `${(-rnd() * 6).toFixed(2)}s`,
            '--t': `${(3 + rnd() * 4).toFixed(2)}s`,
            '--s': (0.6 + rnd() * 0.9).toFixed(2),
          }}
        />
      ))}
      {effect === 'storm' && (
        <svg className="fx-bolt" viewBox="0 0 40 100" preserveAspectRatio="none">
          <path d="M26 0L8 46h12L6 100 34 38H20z" />
        </svg>
      )}
    </div>
  )
}

export default memo(CardFx)
