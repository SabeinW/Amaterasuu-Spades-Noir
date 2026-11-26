import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Flame, Hourglass } from 'lucide-react'
import Sheet from './ui/Sheet'
import { WEEKLY_CHALLENGES } from '../data/challenges'

const CARD = { background: 'rgb(243 234 219 / 0.03)', border: '1px solid rgb(212 166 74 / 0.22)' }
const CARD_DONE = { background: 'linear-gradient(180deg, rgb(212 166 74 / 0.1), rgb(212 166 74 / 0.03))', border: '1px solid rgb(212 166 74 / 0.5)' }
const TABS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'season', label: 'Season' },
]

// Gold-leaf progress bar on a lacquer track.
function Bar({ pct, delay = 0 }) {
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgb(0 0 0 / 0.4)', boxShadow: 'inset 0 1px 2px rgb(0 0 0 / 0.6)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'var(--gold-leaf)', boxShadow: '0 0 10px rgb(241 210 138 / 0.35)' }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

function Tabs({ value, onChange }) {
  const id = useId()
  return (
    <div role="tablist" aria-label="Challenge period" className="flex gap-1 p-1 rounded-[14px]" style={{ background: 'rgb(0 0 0 / 0.35)', border: '1px solid rgb(212 166 74 / 0.2)' }}>
      {TABS.map((t) => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="relative flex-1 min-h-11 rounded-[10px] text-[14px] font-bold transition-colors"
            style={{ color: active ? '#1b1307' : 'rgb(243 234 219 / 0.62)' }}
          >
            {active && (
              <motion.span
                layoutId={`challenge-tab-${id}`}
                className="absolute inset-0 rounded-[10px]"
                style={{ background: 'var(--gold-leaf)', boxShadow: '0 6px 16px -8px rgb(212 166 74 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.5)' }}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function ChallengesModal({ onClose, user, progress = {} }) {
  const [tab, setTab] = useState('weekly')
  const completed = WEEKLY_CHALLENGES.filter((c) => (progress[c.id] ?? 0) >= c.target).length

  return (
    <Sheet open onClose={onClose} eyebrow="Rewards" title="Challenges">
      <div className="rounded-2xl p-4" style={CARD}>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center"
            style={{ background: 'radial-gradient(circle at 35% 30%, rgb(255 106 79 / 0.35), rgb(224 68 46 / 0.1) 70%)', border: '1px solid rgb(224 68 46 / 0.45)' }}
          >
            <Flame className="w-5 h-5 text-verm-hi" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="eyebrow">This week</p>
            <p className="text-[12.5px] text-muted mt-0.5">6 days left this week</p>
          </div>
          <p className="font-display font-extrabold tabular-nums leading-none">
            <span className="gold-text text-[28px]">{completed}</span>
            <span className="text-faint text-lg"> / {WEEKLY_CHALLENGES.length}</span>
          </p>
        </div>
        <div className="mt-3.5">
          <Bar pct={(completed / WEEKLY_CHALLENGES.length) * 100} />
        </div>
      </div>

      <div className="mt-4">
        <Tabs value={tab} onChange={setTab} />
      </div>

      {!user && (
        <div className="mt-4 rounded-2xl px-4 py-3 text-center text-[13px] text-muted" style={{ background: 'rgb(212 166 74 / 0.07)', border: '1px solid rgb(212 166 74 / 0.3)' }}>
          Sign in to track challenge progress and claim rewards
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {tab === 'weekly' ? (
          <motion.div
            key="weekly"
            className="flex flex-col gap-3 mt-4"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            {WEEKLY_CHALLENGES.map((c, i) => {
              const value = progress[c.id] ?? 0
              const pct = Math.min(100, (value / c.target) * 100)
              const done = value >= c.target
              return (
                <motion.div
                  key={c.id}
                  className="rounded-2xl p-4"
                  style={done ? CARD_DONE : CARD}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgb(0 0 0 / 0.35)', border: '1px solid rgb(212 166 74 / 0.22)' }}>
                      {c.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-bold text-paper">{c.title}</p>
                      <p className="text-[12px] leading-snug text-muted">{c.description}</p>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 font-display font-bold text-[15px] tabular-nums text-gold-hi">
                      {done && <Check className="w-4 h-4" aria-label="Complete" />}
                      {value}
                      <span className="text-faint"> / {c.target}</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <Bar pct={pct} delay={0.1 + i * 0.05} />
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[10.5px] uppercase tracking-[0.2em] font-bold text-faint">Reward</span>
                    <span className="text-[13px] font-semibold text-paper">{c.reward}</span>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <motion.div
            key="season"
            className="flex flex-col items-center text-center gap-3 py-10"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgb(212 166 74 / 0.08)', border: '1px solid rgb(212 166 74 / 0.3)' }}>
              <Hourglass className="w-6 h-6 text-gold" />
            </div>
            <p className="text-[14px] text-muted max-w-[260px]">Season challenges reset every 90 days. Check back soon.</p>
          </motion.div>
        )}
      </AnimatePresence>
      <div aria-hidden="true" style={{ height: 'var(--safe-b)' }} />
    </Sheet>
  )
}
