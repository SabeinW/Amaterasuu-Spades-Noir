import { Settings2 } from 'lucide-react'

export default function ScoreBar({ leftLabel, rightLabel, leftScore, rightScore, target = 500, onOpenSettings }) {
  return (
    <div className="shrink-0 relative flex items-center justify-center gap-3 py-2 px-3">
      <span className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
        {leftLabel} {leftScore >= 0 ? '+' : ''}
        {leftScore}
      </span>
      <span className="text-[10px] text-white/30">vs</span>
      <span className="text-xs font-semibold" style={{ color: '#ec4899' }}>
        {rightLabel} {rightScore >= 0 ? '+' : ''}
        {rightScore}
      </span>
      <span className="text-[10px] text-white/30">/{target}</span>
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          aria-label="Game settings"
          title="Game settings"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white/80"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
