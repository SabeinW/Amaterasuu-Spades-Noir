const POSITION_STYLE = {
  top: 'top-2 left-1/2 -translate-x-1/2',
  left: 'left-2 top-1/2 -translate-y-1/2',
  right: 'right-2 top-1/2 -translate-y-1/2',
  bottom: 'bottom-2 left-1/2 -translate-x-1/2',
}

export default function SeatChip({ position, player, bid, tricks, isActive, accentColor = '#a78bfa', compact = false }) {
  return (
    <div
      className={`absolute z-10 flex items-center gap-2 rounded-full pl-1 pr-3 py-1 transition-all ${POSITION_STYLE[position]}`}
      style={{
        background: isActive ? `${accentColor}22` : 'rgba(10,8,18,0.7)',
        border: isActive ? `1.5px solid ${accentColor}` : '1px solid rgba(255,255,255,0.1)',
        boxShadow: isActive ? `0 0 18px ${accentColor}55` : 'none',
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: `${accentColor}33`, color: accentColor }}
      >
        {player?.isBot ? '🤖' : (player?.username?.[0] ?? '?').toUpperCase()}
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
