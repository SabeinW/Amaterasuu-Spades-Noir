import { botAvatar, defaultArtAvatar, parseAvatar } from '../../data/avatars'

// Round lacquer medallion with a gold ring. Accepts a raw avatar_url string
// (photo data URI, JSON emoji avatar, or {kind:'art'}), or `bot` + name.
export default function Avatar({ avatarUrl, name, bot = false, size = 48, ring = true, className = '', style }) {
  const a = bot ? botAvatar(name) : avatarUrl ? parseAvatar(avatarUrl) : defaultArtAvatar(name)
  const inner = size - (ring ? 4 : 0)
  return (
    <div
      className={`relative shrink-0 rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        padding: ring ? 2 : 0,
        background: ring ? 'conic-gradient(from 200deg, #a37a2c, #f6dc9a, #d4a64a, #8a6a2b, #f1d28a, #a37a2c)' : undefined,
        boxShadow: '0 6px 14px -6px rgb(0 0 0 / 0.8)',
        ...style,
      }}
    >
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center" style={{ width: inner, height: inner, background: '#14110d' }}>
        {a.kind === 'photo' || a.kind === 'art' ? (
          <img src={a.url ?? a.src} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center"
            style={{ fontSize: inner * 0.5, background: `radial-gradient(circle at 35% 30%, ${a.color}55, ${a.color}18 60%, #14110d 100%)` }}
          >
            {a.emoji}
          </span>
        )}
      </div>
    </div>
  )
}
