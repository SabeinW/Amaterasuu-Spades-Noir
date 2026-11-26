import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Trophy } from 'lucide-react'
import Sheet from './ui/Sheet'
import Avatar from './ui/Avatar'
import { fetchLeaderboard } from '../lib/social'
import { rankForRating } from '../data/ranks'

// Gold, silver and bronze medallions for the podium places.
const MEDALS = {
  1: { bg: 'radial-gradient(circle at 35% 30%, #fff1c9, #d4a64a 55%, #8a6a2b)', ring: 'rgb(241 210 138 / 0.55)' },
  2: { bg: 'radial-gradient(circle at 35% 30%, #fbf7ef, #bdb5a6 55%, #6f685c)', ring: 'rgb(214 207 194 / 0.45)' },
  3: { bg: 'radial-gradient(circle at 35% 30%, #ffd6b0, #c47a42 55%, #6e3d1c)', ring: 'rgb(196 122 66 / 0.5)' },
}

function Place({ rank }) {
  const medal = MEDALS[rank]
  if (!medal) return <span className="w-8 shrink-0 text-center font-display font-bold text-[15px] text-faint tabular-nums">{rank}</span>
  return (
    <span
      className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-display font-extrabold text-[14px] tabular-nums"
      style={{ background: medal.bg, color: '#1b1307', boxShadow: `0 0 0 1px ${medal.ring}, 0 6px 14px -6px rgb(0 0 0 / 0.8)` }}
    >
      {rank}
    </span>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-2" aria-label="Loading leaderboard">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 min-h-[62px] animate-pulse" style={{ background: 'rgb(243 234 219 / 0.03)', border: '1px solid rgb(243 234 219 / 0.06)' }}>
          <span className="w-8 h-8 rounded-full bg-white/[0.06]" />
          <span className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <span className="flex-1 flex flex-col gap-1.5">
            <span className="h-3 w-2/5 rounded-full bg-white/[0.08]" />
            <span className="h-2.5 w-3/5 rounded-full bg-white/[0.05]" />
          </span>
          <span className="h-4 w-10 rounded-full bg-white/[0.07]" />
        </div>
      ))}
    </div>
  )
}

export default function LeaderboardModal({ onClose, currentUserId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboard(20).then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  return (
    <Sheet open onClose={onClose} eyebrow="Ranked play" title="Leaderboard">
      <p className="text-[13px] text-muted -mt-1 mb-4">Top players by rating</p>

      {loading ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center text-center py-10 gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgb(212 166 74 / 0.08)', border: '1px solid rgb(212 166 74 / 0.3)' }}>
            <Trophy className="w-6 h-6 text-gold" />
          </div>
          <p className="text-[14px] text-muted">No ranked players yet — be the first!</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => {
            const rank = i + 1
            const isMe = r.id === currentUserId
            const rating = r.elo_rating ?? 1200
            const tier = rankForRating(rating)
            const winRate = r.total_games ? Math.round(((r.wins ?? 0) / r.total_games) * 100) : 0
            const podium = rank <= 3
            return (
              <motion.li
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 12) * 0.035, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 min-h-[62px]"
                style={{
                  background: isMe ? 'rgb(212 166 74 / 0.11)' : 'rgb(243 234 219 / 0.03)',
                  border: `1px solid ${isMe ? 'rgb(212 166 74 / 0.5)' : podium ? 'rgb(212 166 74 / 0.22)' : 'rgb(243 234 219 / 0.07)'}`,
                }}
              >
                <Place rank={rank} />
                <Avatar avatarUrl={r.avatar_url} name={r.username} size={40} ring={podium || isMe} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-bold truncate">
                    {r.username ?? 'Player'}
                    {isMe && <span className="ml-1.5 text-[11px] font-semibold text-gold">(You)</span>}
                  </p>
                  <p className="text-[11.5px] text-faint tabular-nums truncate">
                    {r.wins ?? 0}W · {r.losses ?? 0}L · {winRate}% win rate
                  </p>
                </div>
                <div className="shrink-0 text-right" title={tier.label}>
                  <p className={`font-display font-extrabold text-[17px] leading-tight tabular-nums ${podium ? 'gold-text' : 'text-gold-hi'}`}>{rating}</p>
                  <p className="text-[11px] text-muted whitespace-nowrap max-w-[96px] truncate">
                    <span aria-hidden="true">{tier.icon}</span> {tier.label}
                  </p>
                </div>
              </motion.li>
            )
          })}
        </ol>
      )}
      <div aria-hidden="true" style={{ height: 'var(--safe-b)' }} />
    </Sheet>
  )
}
