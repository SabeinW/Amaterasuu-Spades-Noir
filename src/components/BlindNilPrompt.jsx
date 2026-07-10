export default function BlindNilPrompt({ onGoBlind, onReveal, accentColor = '#fbbf24' }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 top-16 md:top-20 z-30 w-[92%] max-w-sm rounded-2xl p-5 text-center bg-slate-900/80 backdrop-blur-md border border-amber-500/30 shadow-2xl"
    >
      <p className="font-display font-semibold mb-1" style={{ color: accentColor }}>
        ♠ Bid Blind Nil?
      </p>
      <p className="text-xs text-white/50 mb-4 leading-relaxed">
        Commit to Nil before seeing your hand for double the bonus — or the penalty if you take a trick.
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onGoBlind}
          className="w-full rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: accentColor, color: '#0a0812' }}
        >
          Go Blind Nil (2x)
        </button>
        <button
          onClick={onReveal}
          className="w-full rounded-xl py-2.5 text-sm font-semibold bg-white/5 text-white/70"
        >
          See My Hand First
        </button>
      </div>
    </div>
  )
}
