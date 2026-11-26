// Pre-game room: pick a seat (seats across from each other are partners),
// share the code or link, and the host deals when ready. Empty seats are
// filled with AI players at the start; friends can still take them over
// mid-game by joining with the same code.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Bot, Check, Copy, Crown, LogOut, Share2 } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { fetchAvatars, fetchRoom, leaveTable, sitAt, startTable, subscribeRoom } from '../../lib/online'
import { ruleChips } from './Lobby'

export default function WaitingRoom({ room: initial, user, table, onStart, onLeave }) {
  const [room, setRoom] = useState(initial)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avatars, setAvatars] = useState({})
  const versionRef = useRef(initial.version ?? 0)
  const startedRef = useRef(false)

  const apply = (row) => {
    if (!row || (row.version ?? 0) < versionRef.current) return
    versionRef.current = row.version ?? 0
    setRoom(row)
  }

  useEffect(() => {
    const off = subscribeRoom(initial.id, apply, (s) => s === 'SUBSCRIBED' && fetchRoom(initial.id).then(apply))
    const t = setInterval(() => fetchRoom(initial.id).then(apply), 4000)
    return () => {
      off()
      clearInterval(t)
    }
  }, [initial.id])

  useEffect(() => {
    if (room.status === 'playing' && !startedRef.current) {
      startedRef.current = true
      onStart(room)
    }
    if (room.status === 'closed') onLeave?.(true)
  }, [room, onStart, onLeave])

  const ids = room.players.filter((p) => !p.isBot).map((p) => p.id).join(',')
  useEffect(() => {
    if (ids) fetchAvatars(ids.split(',')).then(setAvatars)
  }, [ids])

  const me = room.players.find((p) => p.id === user?.id)
  const isHost = room.host_id === user?.id
  const bySeat = (s) => room.players.find((p) => p.seat === s)
  const empty = 4 - room.players.length
  const link = `${window.location.origin}/?join=${room.code}`

  async function sit(seat) {
    setError(null)
    try {
      await sitAt(room.id, seat)
      fetchRoom(room.id).then(apply)
    } catch (e) {
      setError(e.message)
    }
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await startTable(room.id)
      apply(res.room)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  async function leave() {
    leaveTable(room.id).catch(() => {})
    onLeave?.(true)
  }

  async function share() {
    const text = `Join my Spades table — code ${room.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Amaterasuu Noir Spades', text, url: link })
        return
      } catch {
        // cancelled
      }
    }
    await navigator.clipboard?.writeText(`${text}\n${link}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Draw the table from my point of view: me at the bottom.
  const mySeat = me?.seat ?? 0
  const SPOTS = [
    { off: 0, cls: 'left-1/2 -translate-x-1/2 bottom-2' },
    { off: 1, cls: 'left-2 top-1/2 -translate-y-1/2' },
    { off: 2, cls: 'left-1/2 -translate-x-1/2 top-2' },
    { off: 3, cls: 'right-2 top-1/2 -translate-y-1/2' },
  ]

  return (
    <div className="fixed inset-0 overflow-y-auto" style={{ background: table.base }}>
      <div className="fixed inset-0" style={{ background: `url(${table.image}) center / cover no-repeat` }} />
      <div className="fixed inset-0 bg-black/45" />
      <div className="relative min-h-full max-w-lg mx-auto px-5 pt-[calc(1rem+var(--safe-t))] pb-[calc(1.5rem+var(--safe-b))] flex flex-col">
        <div className="flex items-center justify-between">
          <button onClick={leave} className="btn btn-ghost !min-h-10 !px-3 !text-[13px]">
            <LogOut className="w-4 h-4" /> Leave
          </button>
          <span className="eyebrow">Waiting room</span>
        </div>

        <div className="text-center mt-6">
          <p className="text-[12px] text-muted">Table code</p>
          <motion.p className="font-display font-extrabold text-6xl tracking-[0.18em] leaf-shimmer pl-[0.18em]" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {room.code}
          </motion.p>
          <div className="flex justify-center gap-2 mt-3">
            <button className="btn btn-ghost !min-h-10 !text-[13px]" onClick={share}>
              {copied ? <Check className="w-4 h-4 text-gold" /> : navigator.share ? <Share2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Link copied' : 'Invite friends'}
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 mt-4">
            {ruleChips(room.settings).map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
        </div>

        {/* mini table */}
        <div className="relative mx-auto mt-6 w-full max-w-[360px] aspect-square">
          <div className="absolute inset-[18%] rounded-full" style={{ background: 'radial-gradient(circle at 50% 40%, rgb(241 210 138 / 0.18), rgb(0 0 0 / 0.5) 70%)', border: '1px solid rgb(212 166 74 / 0.35)' }} />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[11px] text-faint text-center leading-relaxed">
              Across from you
              <br />
              is your partner
            </p>
          </div>
          {SPOTS.map(({ off, cls }) => {
            const seat = (mySeat + off) % 4
            const p = bySeat(seat)
            const isMe = p?.id === user?.id
            const team = seat % 2 === mySeat % 2 ? 'us' : 'them'
            return (
              <div key={seat} className={`absolute ${cls} flex flex-col items-center w-[104px]`}>
                <AnimatePresence mode="wait">
                  {p ? (
                    <motion.div key={p.id} className="flex flex-col items-center" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}>
                      <div className="relative">
                        <Avatar avatarUrl={avatars[p.id]} name={p.name} size={56} />
                        {room.host_id === p.id && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 text-gold-hi" />}
                      </div>
                      <p className="text-[12.5px] font-bold mt-1 truncate max-w-full">{isMe ? 'You' : p.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: team === 'us' ? '#d4a64a' : '#ff8a72' }}>
                        {team === 'us' ? (isMe ? 'Team us' : 'Partner') : 'Opponent'}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="empty"
                      onClick={() => sit(seat)}
                      className="flex flex-col items-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ border: '1.5px dashed rgb(212 166 74 / 0.5)', background: 'rgb(0 0 0 / 0.3)' }}>
                        <Bot className="w-5 h-5 text-faint" />
                      </span>
                      <p className="text-[12px] font-semibold mt-1 text-gold-hi">Sit here</p>
                      <p className="text-[10px] text-faint">{team === 'us' ? 'as my partner' : 'opponent'}</p>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        <div className="mt-auto pt-6">
          {error && <p className="text-[13px] text-verm-hi text-center mb-2">{error}</p>}
          {isHost ? (
            <button className="btn btn-gold w-full !min-h-[56px] !text-[16px]" disabled={busy} onClick={start}>
              {busy ? 'Dealing…' : empty ? `Start with ${empty} AI player${empty > 1 ? 's' : ''}` : 'Start the game'}
            </button>
          ) : (
            <div className="panel-soft rounded-2xl py-4 text-center text-[14px] text-muted">
              Waiting for <b className="text-paper">{room.host_name}</b> to deal…
            </div>
          )}
          <p className="text-[11.5px] text-faint text-center mt-2">Empty seats get AI players. A friend can still take one over later with the code.</p>
        </div>
      </div>
    </div>
  )
}
