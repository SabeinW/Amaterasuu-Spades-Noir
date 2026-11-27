import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, Flame, GraduationCap, Layers, Palette, RotateCcw, Trophy, User, Users, Bot, LogIn } from 'lucide-react'
import Card from './cards/Card'
import Avatar from './ui/Avatar'
import NotificationsCard from './ui/NotificationsCard'
import LevelBadge from './ui/LevelBadge'
import { toggleDiag } from '../lib/diag'
import { levelProgress } from '../data/levels'
import { ALL_DECKS } from '../data/tableThemes'

// The home screen always shows the Sun Court deck's royals.
const HERO_DECK = ALL_DECKS.find((d) => d.id === 'sun-court')

// A hand fanned out on the home screen: both Jokers flank the A♠ and Q♥.
const HERO_CARDS = [
  { card: { suit: 'JOKER', value: 'SMALL', id: 'JOKER_SMALL' }, r: -15, x: -112, y: 16, d: 0, z: 1 },
  { card: { suit: 'S', value: 'A', id: 'AS' }, r: -5, x: -37, y: 0, d: 0.4, z: 2 },
  { card: { suit: 'H', value: 'Q', id: 'QH' }, r: 5, x: 37, y: 0, d: 0.8, z: 3 },
  { card: { suit: 'JOKER', value: 'BIG', id: 'JOKER_BIG' }, r: 15, x: 112, y: 16, d: 1.2, z: 4 },
]

function HeroArt() {
  const reduce = useReducedMotion()
  const [wide, setWide] = useState(() => window.matchMedia('(min-aspect-ratio: 1/1)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-aspect-ratio: 1/1)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const saveData = navigator.connection?.saveData
  const poster = wide ? '/art/hero/hero-wide.webp' : '/art/hero/hero.webp'
  const src = wide ? '/art/hero/hero-wide-loop.mp4' : '/art/hero/hero-loop.mp4'
  const style = { objectPosition: wide ? '50% 50%' : '50% 62%' }
  return (
    <div className="fixed inset-0 pointer-events-none">
      {reduce || saveData ? (
        <img src={poster} alt="" className="w-full h-full object-cover" style={style} />
      ) : (
        <video key={src} src={src} poster={poster} autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover" style={style} aria-hidden="true" />
      )}
    </div>
  )
}

function Tile({ icon: Icon, label, sub, onClick, delay }) {
  return (
    <motion.button
      onClick={onClick}
      className="panel-soft hover-tile rounded-2xl p-3.5 text-left flex flex-col gap-2 min-h-[92px]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
      whileTap={{ scale: 0.97 }}
    >
      <span className="tile-icon w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgb(212 166 74 / 0.12)', border: '1px solid rgb(212 166 74 / 0.25)' }}>
        <Icon className="w-[18px] h-[18px] text-gold-hi" />
      </span>
      <span>
        <span className="block text-[14px] font-bold leading-tight">{label}</span>
        {sub && <span className="block text-[11.5px] text-faint mt-0.5">{sub}</span>}
      </span>
    </motion.button>
  )
}

export default function Landing({
  user,
  profile,
  deck,
  onPlayOnline,
  onPractice,
  onLearn,
  onOpenAuth,
  onOpenDecks,
  onOpenTables,
  onOpenRules,
  onOpenChallenges,
  onOpenProfile,
  onOpenLeaderboard,
  rejoinableRoom,
  onRejoin,
  savedPractice,
  onResumePractice,
}) {
  const name = profile?.username || user?.email?.split('@')[0]
  const tapsRef = useRef([])
  const secretTap = () => {
    const now = Date.now()
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < 2500), now]
    if (tapsRef.current.length >= 5) toggleDiag()
  }
  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-ink">
      {/* key art: a seamless 5s loop (sun shimmer, drifting mist), poster-first */}
      <HeroArt />
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgb(11 10 8 / 0.05) 0%, rgb(11 10 8 / 0.2) 45%, rgb(11 10 8 / 0.85) 76%, #0b0a08 100%)' }} />
      <div
        className="fixed inset-x-[-10%] top-[30%] h-40 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgb(243 234 219 / 0.25), transparent 70%)', filter: 'blur(20px)', animation: 'mistDrift 14s ease-in-out infinite alternate' }}
      />

      <div className="relative min-h-full flex flex-col max-w-xl mx-auto px-5 pb-[calc(2rem+var(--safe-b))] pt-[calc(1rem+var(--safe-t))]">
        <div className="flex items-center justify-between">
          {/* tap 5 times quickly: turns the phone health check on or off (lib/diag.js) */}
          <span className="eyebrow opacity-80 select-none" onClick={secretTap}>
            amaterasuu.com
          </span>
          {user ? (
            <button onClick={onOpenProfile} className="flex items-center gap-2 panel-soft hover-tile rounded-full pl-1 pr-3 py-1" aria-label="Profile">
              <Avatar avatarUrl={profile?.avatar_url} size={32} />
              <span className="flex flex-col items-start leading-tight min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold max-w-[110px] truncate">{name}</span>
                  {profile && <LevelBadge xp={profile.xp ?? 0} />}
                </span>
                {profile && (
                  <span className="mt-1 h-1 w-full min-w-[64px] rounded-full overflow-hidden" style={{ background: 'rgb(0 0 0 / 0.45)' }} aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${Math.round(levelProgress(profile.xp ?? 0).progress * 100)}%`, background: 'var(--gold-leaf)' }} />
                  </span>
                )}
              </span>
            </button>
          ) : (
            <button onClick={onOpenAuth} className="btn btn-ghost !min-h-10 !px-4 !text-[13px]">
              <LogIn className="w-4 h-4" /> Sign in
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-end pt-[20vh] sm:pt-[16vh] pb-6 text-center">
          <div className="relative h-[160px] w-[320px] mb-2">
            {HERO_CARDS.map(({ card, r, x, y, d, z }) => (
              <motion.div
                key={card.id}
                className="absolute left-1/2 top-0"
                initial={{ opacity: 0, y: 60, rotate: 0, x: '-50%' }}
                animate={{ opacity: 1, y: [y, y - 8, y], rotate: r, x: `calc(-50% + ${x}px)` }}
                transition={{
                  opacity: { delay: 0.2 + d * 0.15, duration: 0.5 },
                  rotate: { delay: 0.2 + d * 0.15, type: 'spring', stiffness: 120, damping: 14 },
                  x: { delay: 0.2 + d * 0.15, type: 'spring', stiffness: 120, damping: 14 },
                  y: { delay: 1 + d, duration: 4.5, repeat: Infinity, ease: 'easeInOut' },
                }}
                style={{ zIndex: z }}
              >
                <Card card={card} deck={HERO_DECK ?? deck} width={82} />
              </motion.div>
            ))}
          </div>
          <motion.h1
            className="text-[46px] sm:text-[58px] font-extrabold leading-[0.95] leaf-shimmer"
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          >
            Amaterasuu
          </motion.h1>
          <motion.p
            className="font-display tracking-[0.5em] text-[13px] sm:text-[15px] text-paper/85 mt-2 pl-[0.5em]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            NOIR SPADES
          </motion.p>
          <motion.p className="text-[13.5px] text-muted mt-3 max-w-[320px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}>
            Spades with your people — online tables, sharp AI partners, gold-leaf decks.
          </motion.p>
        </div>

        <div className="flex flex-col gap-2 mb-3">
          {user && <NotificationsCard variant="banner" />}
          {rejoinableRoom && (
            <motion.button onClick={onRejoin} className="btn btn-verm w-full" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <RotateCcw className="w-4 h-4" /> Rejoin table {rejoinableRoom.code}
            </motion.button>
          )}
          {savedPractice && (
            <motion.button onClick={onResumePractice} className="btn btn-ghost w-full !text-[14px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <RotateCcw className="w-4 h-4 text-gold" /> Resume {savedPractice.coached ? 'coached game' : 'practice'} · round {savedPractice.full.pub.round} · {savedPractice.full.pub.scores.A.total}–{savedPractice.full.pub.scores.B.total}
            </motion.button>
          )}
        </div>

        <motion.div className="grid gap-2.5" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <button onClick={onPlayOnline} className="btn btn-gold w-full !min-h-[56px] !text-[16px]">
            <Users className="w-5 h-5" /> Play online
          </button>
          <button onClick={onPractice} className="btn btn-ghost w-full !min-h-[52px]">
            <Bot className="w-5 h-5 text-gold" /> Practice vs AI
          </button>
          <button onClick={onLearn} className="btn btn-ghost w-full !min-h-[48px] !text-[14px]">
            <GraduationCap className="w-5 h-5 text-gold" /> New to Spades? Learn to play
          </button>
          {!user && <p className="text-center text-[12px] text-faint">Sign in to play online and keep your stats.</p>}
        </motion.div>

        <div className="grid grid-cols-3 gap-2.5 mt-6">
          <Tile icon={Layers} label="Decks" sub={`${ALL_DECKS.length} decks · 5 skin tones`} onClick={onOpenDecks} delay={1.05} />
          <Tile icon={Palette} label="Tables" sub="15 surfaces" onClick={onOpenTables} delay={1.1} />
          <Tile icon={BookOpen} label="House rules" sub="Nil, bags, JD" onClick={onOpenRules} delay={1.15} />
          <Tile icon={Trophy} label="Leaderboard" onClick={onOpenLeaderboard} delay={1.2} />
          <Tile icon={Flame} label="Challenges" onClick={onOpenChallenges} delay={1.25} />
          <Tile icon={User} label={user ? 'Profile' : 'Sign in'} onClick={user ? onOpenProfile : onOpenAuth} delay={1.3} />
        </div>
      </div>
    </div>
  )
}
