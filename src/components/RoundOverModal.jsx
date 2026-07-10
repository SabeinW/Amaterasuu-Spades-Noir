export default function RoundOverModal({ roundDetail, runningScores, getSeatLabel, isHost, onNextRound, onQuit, accentColor = '#a78bfa' }) {
  const positions = ['bottom', 'left', 'top', 'right']
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-2xl p-6 animate-fadeUp"
        style={{ background: 'rgba(14,11,22,0.95)', border: `1px solid ${accentColor}55`, boxShadow: `0 0 40px ${accentColor}22` }}
      >
        <h3 className="font-display text-lg font-bold text-center mb-1">Round Complete</h3>
        <p className="text-center text-white/40 text-xs mb-5">Here's how everyone did</p>
        <div className="flex flex-col gap-2 mb-5">
          {positions.map((pos) => {
            const d = roundDetail?.[pos]
            if (!d) return null
            return (
              <div key={pos} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold">{getSeatLabel(pos)}</p>
                  <p className="text-[11px] text-white/40">
                    Bid {d.bid === 0 ? 'Nil' : d.bid} · Took {d.taken}
                    {d.penaltyThisRound > 0 ? ` · -${d.penaltyThisRound} bag penalty` : ''}
                  </p>
                </div>
                <span className="font-bold" style={{ color: d.score >= 0 ? '#4ade80' : '#f87171' }}>
                  {d.score >= 0 ? '+' : ''}
                  {d.score}
                </span>
              </div>
            )
          })}
        </div>
        <div className="flex flex-col gap-1.5 mb-6">
          {positions.map((pos) => (
            <div key={pos} className="flex items-center justify-between text-xs">
              <span className="text-white/50">{getSeatLabel(pos)} total</span>
              <span className="font-semibold text-white/80">
                {runningScores?.[pos]?.total ?? 0} pts · {runningScores?.[pos]?.bags ?? 0} bags
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onQuit} className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white/5 text-white/60">
            Leave
          </button>
          {isHost ? (
            <button onClick={onNextRound} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: accentColor, color: '#0a0812' }}>
              Next Round
            </button>
          ) : (
            <p className="flex-1 flex items-center justify-center text-xs text-white/30">Waiting for host…</p>
          )}
        </div>
      </div>
    </div>
  )
}
