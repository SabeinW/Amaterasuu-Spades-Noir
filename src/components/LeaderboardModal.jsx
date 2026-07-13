import { useEffect, useState } from 'react'
import { X, Trophy } from 'lucide-react'
import { fetchLeaderboard } from '../lib/social'
import { parseAvatar } from '../data/avatars'
import { rankForRating } from '../data/ranks'

const RANK_COLORS = { 1: '#f5d90a', 2: '#cbd5e1', 3: '#f97316' }

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp bg-slate-900/90 backdrop-blur-md border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,217,10,0.15)' }}>
              <Trophy className="w-4 h-4" style={{ color: '#f5d90a' }} />
            </div>
            <div>
              <h3 className="font-display font-bold">Leaderboard</h3>
              <p className="text-xs text-white/40">Top players by rating</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <p className="text-center text-white/30 text-sm py-8">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-white/30 text-sm py-8">No ranked players yet — be the first!</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((r, i) => {
              const rank = i + 1
              const avatar = parseAvatar(r.avatar_url)
              const isMe = r.id === currentUserId
              const winRate = r.total_games ? Math.round(((r.wins ?? 0) / r.total_games) * 100) : 0
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{ background: isMe ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)', border: isMe ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent' }}
                >
                  <span className="w-6 text-center text-sm font-bold" style={{ color: RANK_COLORS[rank] ?? 'rgba(255,255,255,0.4)' }}>
                    {rank}
                  </span>
                  {avatar.kind === 'photo' ? (
                    <img src={avatar.url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: `${avatar.color}33`, border: `1px solid ${avatar.color}66` }}
                    >
                      <span className="text-sm">{avatar.emoji}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{r.username ?? 'Player'}{isMe ? ' (You)' : ''}</p>
                    <p className="text-[10px] text-white/40">{r.wins ?? 0}W · {r.losses ?? 0}L · {winRate}% win rate</p>
                  </div>
                  <span className="text-sm" title={rankForRating(r.elo_rating ?? 1200).label}>{rankForRating(r.elo_rating ?? 1200).icon}</span>
                  <span className="text-sm font-bold text-white/80">{r.elo_rating ?? 1200}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
