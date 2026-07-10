export default function PlayerLeftModal({ playerName, isHost, onReplaceBot, onLeave, accentColor = '#a78bfa' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-xs rounded-2xl p-6 text-center animate-fadeUp" style={{ background: 'rgba(14,11,22,0.95)', border: `1px solid ${accentColor}55` }}>
        <p className="text-3xl mb-3">🚪</p>
        <h3 className="font-display font-bold mb-1">{playerName ?? 'A player'} left</h3>
        <p className="text-white/40 text-xs mb-6">You can replace them with a bot to keep playing, or leave the match.</p>
        <div className="flex flex-col gap-2">
          {isHost && (
            <button onClick={onReplaceBot} className="rounded-xl py-2.5 text-sm font-semibold" style={{ background: accentColor, color: '#0a0812' }}>
              Replace with Bot
            </button>
          )}
          <button onClick={onLeave} className="rounded-xl py-2.5 text-sm font-semibold bg-white/5 text-white/60">
            Leave Match
          </button>
        </div>
      </div>
    </div>
  )
}
