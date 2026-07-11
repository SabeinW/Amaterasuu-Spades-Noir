import { useEffect, useRef, useState } from 'react'
import { Repeat } from 'lucide-react'
import { subscribeToRoom, leaveRoom, movePlayerToSeat, startGame, fetchRoom } from '../lib/rooms'
import { parseAvatar } from '../data/avatars'

const TEAMS = [
  { label: 'Team A', seats: [0, 2], color: '#a78bfa' },
  { label: 'Team B', seats: [1, 3], color: '#ec4899' },
]

function SeatSlot({ seat, player, isHost, isMe, canSit, onSit, color }) {
  const avatar = player ? parseAvatar(player.avatar_url) : null
  return (
    <div
      className="flex items-center justify-between rounded-xl px-4 py-3"
      style={{ background: isMe ? `${color}22` : 'rgba(255,255,255,0.05)', border: isMe ? `1px solid ${color}88` : '1px solid transparent' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {avatar?.kind === 'photo' ? (
          <img src={avatar.url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : avatar ? (
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: `${avatar.color}33`, border: `1px solid ${avatar.color}66` }}>
            <span className="text-sm">{avatar.emoji}</span>
          </div>
        ) : null}
        <span className="text-sm font-medium truncate">{player ? player.name : `Seat ${seat + 1} — open`}</span>
        {isHost && <span className="text-[10px] text-amber-300 font-semibold shrink-0">HOST</span>}
      </div>
      {canSit && !player && (
        <button onClick={onSit} className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color }}>
          <Repeat className="w-3 h-3" /> Sit Here
        </button>
      )}
    </div>
  )
}

export default function RoomWaitingScreen({ room: initialRoom, myUserId, onStart, onLeave }) {
  const [room, setRoom] = useState(initialRoom)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

  const startedRef = useRef(false)

  useEffect(() => {
    const sub = subscribeToRoom(initialRoom.id, (updated) => {
      setRoom(updated)
      if (updated.status === 'playing' && !startedRef.current) {
        startedRef.current = true
        onStart(updated)
      }
    })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.id])

  // Safety net: the postgres_changes UPDATE event above can be missed if this
  // client's realtime channel hasn't finished subscribing yet (much more
  // common on slower/mobile connections) right when the host starts the
  // game — leaving this screen stuck on "Waiting for the host…" forever
  // with no error, since nothing actually failed, an event was just never
  // delivered. Poll a direct read as a fallback so a missed event can't
  // strand the guest here.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (startedRef.current) return
      const fresh = await fetchRoom(initialRoom.id)
      if (fresh && fresh.status === 'playing' && !startedRef.current) {
        startedRef.current = true
        onStart(fresh)
      }
    }, 2000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.id])

  const isHost = room.host_id === myUserId
  const mySeat = room.players.find((p) => p.id === myUserId)?.seat

  async function handleSit(seat) {
    setError(null)
    try {
      await movePlayerToSeat(room.id, myUserId, seat)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleStart() {
    setStarting(true)
    try {
      const updated = await startGame(room.id)
      onStart(updated)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 text-center gap-6">
      <div>
        <p className="text-xs text-white/40 tracking-widest uppercase mb-1">Room Code</p>
        <p className="font-display text-4xl font-extrabold tracking-[0.3em]">{room.code}</p>
        <p className="text-white/40 text-xs mt-2">Share this code so others can join</p>
      </div>
      <div className="w-full max-w-xs flex flex-col gap-4">
        <p className="text-[10px] text-white/30 -mb-2">Tap an open seat to choose your team — seatmates are partners</p>
        {TEAMS.map((team) => (
          <div key={team.label} className="flex flex-col gap-2">
            <p className="text-[10px] tracking-widest font-semibold uppercase" style={{ color: team.color }}>{team.label}</p>
            {team.seats.map((seat) => (
              <SeatSlot
                key={seat}
                seat={seat}
                player={room.players.find((pl) => pl.seat === seat)}
                isHost={room.players.find((pl) => pl.seat === seat)?.id === room.host_id}
                isMe={seat === mySeat}
                canSit={mySeat !== undefined && seat !== mySeat}
                onSit={() => handleSit(seat)}
                color={team.color}
              />
            ))}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {isHost ? (
        <button
          onClick={handleStart}
          disabled={starting}
          className="rounded-xl px-8 py-3 font-semibold text-sm disabled:opacity-50"
          style={{ background: 'linear-gradient(90deg,#a78bfa,#38bdf8)', color: '#0a0812' }}
        >
          {starting ? 'Starting…' : `Start Game${room.players.length < 4 ? ' (fills empty seats with bots)' : ''}`}
        </button>
      ) : (
        <p className="text-white/40 text-sm">Waiting for the host to start the game…</p>
      )}
      <button
        onClick={() => {
          leaveRoom(room.id, myUserId)
          onLeave()
        }}
        className="text-white/30 text-xs"
      >
        Leave Room
      </button>
    </div>
  )
}
