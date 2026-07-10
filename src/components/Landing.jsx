import { Layers, Palette, Sliders, Trophy, Bot, CreditCard, Settings2, BarChart3, Globe, History, User } from 'lucide-react'

const PILLS = [
  { icon: Trophy, label: 'Ranked Matches' },
  { icon: Bot, label: 'AI Bots' },
  { icon: CreditCard, label: '13 Deck Themes' },
  { icon: Settings2, label: 'Custom Rules' },
  { icon: BarChart3, label: 'Scoreboard' },
  { icon: Globe, label: 'Multiplayer' },
  { icon: History, label: 'History' },
]

export default function Landing({ user, onPlayOnline, onQuickGame, onOpenAuth, onOpenDeckThemes, onOpenTableThemes, onOpenRules }) {
  return (
    <div className="min-h-full flex flex-col items-center px-6 py-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.18), transparent 60%)' }} />

      <div className="w-full flex items-center justify-between max-w-3xl mb-10 relative z-10">
        <div className="flex items-center gap-2 font-display font-bold">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)' }}>
            ♠
          </span>
          Amaterasuu <span style={{ color: '#818cf8' }}>Noir</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenDeckThemes} title="Deck Themes" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60">
            <Layers className="w-4 h-4" />
          </button>
          <button onClick={onOpenTableThemes} title="Table Themes" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60">
            <Palette className="w-4 h-4" />
          </button>
          <button onClick={onOpenRules} title="Game Rules" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60">
            <Sliders className="w-4 h-4" />
          </button>
          {user ? (
            <div className="w-9 h-9 rounded-full bg-indigo-500/30 flex items-center justify-center text-white/80">
              <User className="w-4 h-4" />
            </div>
          ) : (
            <button onClick={onOpenAuth} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold" style={{ background: 'linear-gradient(90deg,#a78bfa,#38bdf8)', color: '#0a0812' }}>
              <User className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-md mt-4">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl mb-6 animate-float"
          style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', boxShadow: '0 0 60px rgba(167,139,250,0.5)' }}
        >
          ♠
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold leading-tight mb-3">
          Amaterasuu <span style={{ background: 'linear-gradient(90deg,#a78bfa,#38bdf8)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Noir</span> Spades
        </h1>
        <p className="text-white/50 text-sm mb-8">
          The premium Spades experience on amaterasuu.com — compete, customize, conquer.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={onPlayOnline}
            className="rounded-2xl py-3.5 font-semibold text-sm"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(167,139,250,0.4)' }}
          >
            {user ? 'Play Now ♠' : 'Find a Match ♠'}
          </button>
          <button
            onClick={onQuickGame}
            className="rounded-2xl py-3.5 font-semibold text-sm flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(56,189,248,0.4)' }}
          >
            ⚙️ Quick Game vs AI
          </button>
        </div>

        {!user && <p className="text-white/25 text-xs mt-4">Sign in to save progress</p>}

        <div className="flex flex-wrap justify-center gap-2 mt-8 max-w-sm">
          {PILLS.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-white/50">
              <Icon className="w-3 h-3" /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
