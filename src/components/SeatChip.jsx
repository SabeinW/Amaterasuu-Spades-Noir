import { parseAvatar, borderStyle, botAvatar } from '../data/avatars'

const POSITION_STYLE = {
  top: 'top-2 left-1/2 -translate-x-1/2',
  left: 'left-2 top-1/2 -translate-y-1/2',
  right: 'right-2 top-1/2 -translate-y-1/2',
  bottom: 'bottom-2 left-1/2 -translate-x-1/2',
}

export default function SeatChip({ position, player, bid, tricks, isActive, accentColor = '#a78bfa', compact = false }) {
  const avatar = player ? (player.isBot ? botAvatar(player.username) : parseAvatar(player.avatar_url)) : null
  return (
    <div
      className={`absolute z-10 flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border transition-all ${isActive ? 'bg-amber-500/15 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.5)]' : 'bg-slate-900/70 border-white/10'} ${POSITION_STYLE[position]}`}
    >
      <div style={avatar?.border ? borderStyle(avatar.border, 28) : undefined} className="shrink-0">
        {avatar?.kind === 'photo' ? (
          <img src={avatar.url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0 block" />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={avatar ? { background: `${avatar.color}33`, border: `1px solid ${avatar.color}66` } : { background: `${accentColor}33`, color: accentColor }}
          >
            {avatar ? <span className="text-sm">{avatar.emoji}</span> : (player?.username?.[0] ?? '?').toUpperCase()}
          </div>
        )}
      </div>
      {!compact && (
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-semibold text-white/85 max-w-[70px] truncate">{player?.username ?? 'Waiting…'}</span>
          <span className="text-[10px] text-white/45">
            {bid === null || bid === undefined ? 'no bid' : `${bid === 0 ? 'Nil' : bid} bid`} · {tricks ?? 0} won
          </span>
        </div>
      )}
    </div>
  )
}
