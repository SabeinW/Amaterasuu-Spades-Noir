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

const PARTICLES = { blackbolt: 4, moon: 5, ember: 7, frost: 6, bloom: 5, starfall: 6, dune: 7, cloud: 5, storm: 1, neon: 8, mural: 7, hero: 0, venom: 5, cosmic: 7, aurora: 0, tide: 0, gold: 0, jade: 0, eclipse: 0 }

function CardFx({ effect, id, radius }) {
  if (!effect) return null
  const rnd = seed(id)
  const phase = -(rnd() * 8).toFixed(2)
  const n = PARTICLES[effect] ?? 0
  // blackbolt: each card's bolts strike in their own spot
  const bolt = effect === 'blackbolt' ? { '--bx': `${(rnd() * 22 - 11).toFixed(1)}%`, '--br': `${(rnd() * 18 - 9).toFixed(1)}deg` } : null
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
      {(effect === 'storm' || effect === 'cloud') && (
        <svg className="fx-bolt" viewBox="0 0 40 100" preserveAspectRatio="none">
          <path d="M26 0L8 46h12L6 100 34 38H20z" />
        </svg>
      )}
      {effect === 'blackbolt' && (
        // Black lightning: two forked bolts, dark cores with a red electric edge.
        <>
          <svg className="fx-bb fx-bb-a" style={bolt} viewBox="0 0 60 100" preserveAspectRatio="none">
            <path d="M38 0L31 15l4 1-10 17 4 1-9 16 4 1-12 23 3 1-9 25 15-28-3-1 12-19-4-1 11-16-4-1 9-17-4-1 8-16z" />
            <path d="M24 51l-10 7 2 1-9 9 12-8-2-1 10-7z" />
            <path d="M33 16l11 8-2 1 8 7-10-9 2-1-7-5z" />
          </svg>
          <svg className="fx-bb fx-bb-b" style={bolt} viewBox="0 0 60 100" preserveAspectRatio="none">
            <path d="M38 0L31 15l4 1-10 17 4 1-9 16 4 1-12 23 3 1-9 25 15-28-3-1 12-19-4-1 11-16-4-1 9-17-4-1 8-16z" />
            <path d="M24 51l-10 7 2 1-9 9 12-8-2-1 10-7z" />
          </svg>
        </>
      )}
    </div>
  )
}

export default memo(CardFx)
