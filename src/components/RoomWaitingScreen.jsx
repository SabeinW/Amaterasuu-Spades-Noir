import { useEffect, useState } from 'react'
import { subscribeToRoom, updateRoom, leaveRoom } from '../lib/rooms'

const BOT_NAMES = ['🤖 Sora', '🤖 Noctis', '🤖 Sakura']

export default function RoomWaitingScreen({ room: initialRoom, myUserId, onStart, onLeave }) {
  const [room, setRoom] = useState(initialRoom)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const sub = subscribeToRoom(initialRoom.id, (updated) => {
      setRoom(updated)
      if (updated.status === 'playing') onStart(updated)
    })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom.id])

  const isHost = room.host_id === myUserId

  async function handleStart() {
    setStarting(true)
    const filled = [...room.players]
    let botIdx = 0
    for (let seat = 0; seat < 4; seat++) {
      if (!filled.some((p) => p.seat === seat)) {
        filled.push({ id: `__bot__${seat}`, name: BOT_NAMES[botIdx % BOT_NAMES.length], seat, isBot: true })
        botIdx++
      }
    }
    await updateRoom(room.id, { players: filled, player_count: filled.length, status: 'playing' })
    onStart({ ...room, players: filled, status: 'playing' })
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 py-10 text-center gap-6">
      <div>
        <p className="text-xs text-white/40 tracking-widest uppercase mb-1">Room Code</p>
        <p className="font-display text-4xl font-extrabold tracking-[0.3em]">{room.code}</p>
        <p className="text-white/40 text-xs mt-2">Share this code so others can join</p>
      </div>
      <div className="w-full max-w-xs flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, seat) => {
          const p = room.players.find((pl) => pl.seat === seat)
          return (
            <div key={seat} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <span className="text-sm font-medium">{p ? p.name : `Waiting for player ${seat + 1}…`}</span>
              {p?.id === room.host_id && <span className="text-[10px] text-amber-300 font-semibold">HOST</span>}
            </div>
          )
        })}
      </div>
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
