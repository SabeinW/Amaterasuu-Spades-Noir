import ConfettiCanvas from './ConfettiCanvas'

export default function MatchWinnerModal({ winnerLabel, finalScores, onQuit, accentColor = '#fbbf24' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-hidden">
      <ConfettiCanvas active color={accentColor} />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-8 text-center animate-fadeUp bg-slate-900/80 backdrop-blur-md"
        style={{ border: `1px solid ${accentColor}88`, boxShadow: `0 0 60px ${accentColor}44` }}
      >
        <p className="text-4xl mb-2">🏆</p>
        <h2 className="font-display text-2xl font-extrabold mb-1" style={{ color: accentColor }}>
          {winnerLabel} wins!
        </h2>
        <p className="text-white/40 text-sm mb-6">First to 500 points takes the match.</p>
        <div className="flex flex-col gap-1.5 mb-8 text-left">
          {Object.entries(finalScores ?? {}).map(([pos, s]) => (
            <div key={pos} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-3 py-2">
              <span className="text-white/60 capitalize">{pos}</span>
              <span className="font-bold">{s.total}</span>
            </div>
          ))}
        </div>
        <button onClick={onQuit} className="w-full rounded-xl py-3 font-semibold" style={{ background: accentColor, color: '#0a0812' }}>
          Return to Lobby
        </button>
      </div>
    </div>
  )
}
