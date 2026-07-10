import { useState } from 'react'
import { X, Flame, Zap } from 'lucide-react'
import { WEEKLY_CHALLENGES } from '../data/challenges'

export default function ChallengesModal({ onClose, user, progress = {} }) {
  const [tab, setTab] = useState('weekly')
  const completed = WEEKLY_CHALLENGES.filter((c) => (progress[c.id] ?? 0) >= c.target).length

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp" style={{ background: 'rgba(12,10,20,0.98)', border: '1px solid rgba(251,146,60,0.25)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(251,146,60,0.15)' }}>
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h3 className="font-display font-bold">Challenges</h3>
              <p className="text-xs text-white/40">6 days left this week</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl bg-white/5 px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-[11px] tracking-widest text-white/40 font-semibold uppercase flex-1">This Week</span>
          <span className="text-sm font-bold">{completed} / {WEEKLY_CHALLENGES.length}</span>
          <Zap className="w-4 h-4 text-orange-400" />
        </div>
        <div className="h-1.5 rounded-full bg-white/10 mb-5 -mt-3 overflow-hidden">
          <div className="h-full rounded-full bg-orange-400" style={{ width: `${(completed / WEEKLY_CHALLENGES.length) * 100}%` }} />
        </div>

        <div className="flex rounded-xl bg-white/5 p-1 mb-4">
          {['weekly', 'season'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-lg py-2 text-xs font-semibold capitalize"
              style={{ background: tab === t ? 'rgba(251,146,60,0.2)' : 'transparent', color: tab === t ? '#fdba74' : 'rgba(255,255,255,0.4)' }}
            >
              {t === 'season' ? '🏆 Season' : '📋 Weekly'}
            </button>
          ))}
        </div>

        {!user && (
          <div className="rounded-xl bg-orange-400/10 border border-orange-400/20 text-center text-xs text-orange-200/80 py-2.5 mb-4">
            Sign in to track challenge progress and claim rewards
          </div>
        )}

        {tab === 'weekly' ? (
          <div className="flex flex-col gap-3">
            {WEEKLY_CHALLENGES.map((c) => {
              const value = progress[c.id] ?? 0
              const pct = Math.min(100, (value / c.target) * 100)
              return (
                <div key={c.id} className="rounded-xl bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${c.color}22` }}>
                      {c.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="text-[11px] text-white/40">{c.description}</p>
                    </div>
                    <span className="text-xs font-bold" style={{ color: c.color }}>
                      {value} / {c.target}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/30">
                    <span className="uppercase tracking-widest">Reward</span>
                    <span className="text-white/60 font-medium">{c.reward}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-center text-white/30 text-sm py-8">Season challenges reset every 90 days. Check back soon.</p>
        )}
      </div>
    </div>
  )
}
