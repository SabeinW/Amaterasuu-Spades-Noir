import { useState } from 'react'
import { Layers, Palette, Sliders, Trophy, Bot, CreditCard, Settings2, Flame, Globe, Sparkles, User } from 'lucide-react'
import PlayingCard from './PlayingCard'
import { parseAvatar } from '../data/avatars'

const FAN_CARDS = [
  { suit: 'S', value: 'A', rotate: -24, x: -78, accentColor: '#a78bfa', delay: '0s' },
  { suit: 'H', value: 'K', rotate: -8, x: -26, accentColor: '#fb4f6f', delay: '0.12s' },
  { suit: 'JOKER', value: 'BIG', rotate: 8, x: 26, accentColor: '#f5d90a', delay: '0.24s' },
  { suit: 'D', value: 'Q', rotate: 24, x: 78, accentColor: '#38bdf8', delay: '0.36s' },
]

export default function Landing({
  user,
  profile,
  onPlayOnline,
  onQuickGame,
  onOpenAuth,
  onOpenDeckThemes,
  onOpenTableThemes,
  onOpenRules,
  onOpenChallenges,
  onOpenProfile,
  onOpenLeaderboard,
}) {
  const avatar = profile ? parseAvatar(profile.avatar_url) : null
  const [hoveredCard, setHoveredCard] = useState(null)
  const [pinnedCard, setPinnedCard] = useState(null)
  const PILLS = [
    { icon: Trophy, label: 'Leaderboard', onClick: onOpenLeaderboard },
    { icon: Bot, label: 'AI Bots', onClick: onQuickGame },
    { icon: CreditCard, label: '29 Deck Themes', onClick: onOpenDeckThemes },
    { icon: Settings2, label: 'Custom Rules', onClick: onOpenRules },
    { icon: Flame, label: 'Challenges', onClick: onOpenChallenges },
    { icon: Globe, label: 'Multiplayer', onClick: onPlayOnline },
    { icon: Palette, label: 'Table Themes', onClick: onOpenTableThemes },
  ]
  return (
    <div className="min-h-full flex flex-col items-center px-6 py-6 text-center relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.18), transparent 60%)' }} />

      <div className="w-full flex items-center justify-between flex-wrap gap-y-2 max-w-3xl mb-10 relative z-10">
        <div className="flex items-center gap-2 font-display font-bold text-sm sm:text-base whitespace-nowrap shrink-0">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', color: '#000' }}>
            ♠
          </span>
          Amaterasuu <span style={{ color: '#818cf8' }}>Noir</span> Spades
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          <button onClick={onOpenDeckThemes} title="Deck Themes" aria-label="Deck Themes" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 shrink-0">
            <Layers className="w-4 h-4" />
          </button>
          <button onClick={onOpenTableThemes} title="Table Themes" aria-label="Table Themes" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 shrink-0">
            <Palette className="w-4 h-4" />
          </button>
          <button onClick={onOpenRules} title="Game Rules" aria-label="Game Rules" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 flex items-center justify-center text-white/60 shrink-0">
            <Sliders className="w-4 h-4" />
          </button>
          {user ? (
            <button
              onClick={onOpenProfile}
              title="Profile"
              aria-label="Profile"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
              style={avatar?.kind === 'emoji' ? { background: `${avatar.color}33`, border: `1px solid ${avatar.color}66` } : { background: 'rgba(99,102,241,0.3)' }}
            >
              {avatar?.kind === 'photo' ? (
                <img src={avatar.url} alt="" className="w-full h-full object-cover" />
              ) : avatar ? (
                <span className="text-sm">{avatar.emoji}</span>
              ) : (
                <User className="w-4 h-4 text-white/80" />
              )}
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              title="Sign In"
              aria-label="Sign In"
              className="flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0"
              style={{ background: 'linear-gradient(90deg,#a78bfa,#38bdf8)', color: '#0a0812' }}
            >
              <User className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-md mt-4">
        <div className="relative w-full flex items-end justify-center" style={{ height: 150 }}>
          {FAN_CARDS.map((c, i) => {
            const isUp = hoveredCard === i || pinnedCard === i
            return (
              <div
                key={`${c.suit}${c.value}`}
                className="absolute bottom-4 left-1/2 animate-fadeIn transition-transform duration-200 ease-out"
                style={{
                  transform: `translateX(-50%) translateX(${c.x}px) rotate(${isUp ? c.rotate * 0.4 : c.rotate}deg) translateY(${isUp ? -14 : 0}px) scale(${isUp ? 1.12 : 1})`,
                  transformOrigin: 'bottom center',
                  animationDelay: c.delay,
                  zIndex: isUp ? 40 : i,
                }}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard((prev) => (prev === i ? null : prev))}
              >
                <div className="hero-card-float" style={{ animationDelay: c.delay }}>
                  <PlayingCard
                    suit={c.suit}
                    value={c.value}
                    size="lg"
                    accentColor={c.accentColor}
                    selected={isUp}
                    onClick={() => setPinnedCard((prev) => (prev === i ? null : i))}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div
          className="w-20 h-20 -mt-2 rounded-3xl flex items-center justify-center text-3xl mb-6 relative z-10 animate-float"
          style={{ background: 'linear-gradient(135deg,#a78bfa,#38bdf8)', boxShadow: '0 0 60px rgba(167,139,250,0.5)', color: '#000' }}
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
            <Sparkles className="w-4 h-4" /> Quick Game vs AI
          </button>
        </div>

        {!user && <p className="text-white/25 text-xs mt-4">Sign in to save progress</p>}

        <div className="flex flex-wrap justify-center gap-2 mt-8 max-w-sm">
          {PILLS.map(({ icon: Icon, label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={!onClick}
              className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-[11px] text-white/50 transition-colors hover:bg-white/10 hover:text-white/75 disabled:cursor-default disabled:hover:bg-white/5 disabled:hover:text-white/50"
            >
              <Icon className="w-3 h-3" /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
