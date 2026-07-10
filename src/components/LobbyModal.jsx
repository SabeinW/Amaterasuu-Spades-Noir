import { useEffect, useState } from 'react'
import { X, Users, Plus, RefreshCw, LogIn } from 'lucide-react'
import { supabaseEnabled } from '../lib/supabase'
import { createRoom, joinRoomByCode, listOpenRooms } from '../lib/rooms'

export default function LobbyModal({ user, onClose, onEnterRoom, onRequireAuth, defaultRules }) {
  const [rooms, setRooms] = useState([])
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    setRooms(await listOpenRooms())
    setLoading(false)
  }

  useEffect(() => {
    if (supabaseEnabled) refresh()
  }, [])

  async function handleCreate() {
    if (!user) return onRequireAuth()
    setError(null)
    try {
      const hostName = user.email?.split('@')[0] ?? 'Host'
      const room = await createRoom(user.id, hostName, defaultRules ?? {})
      onEnterRoom(room)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleJoin() {
    if (!user) return onRequireAuth()
    if (!code.trim()) return
    setError(null)
    try {
      const name = user.email?.split('@')[0] ?? 'Guest'
      const room = await joinRoomByCode(code.trim(), { id: user.id, name })
      onEnterRoom(room)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl p-6 animate-fadeUp" style={{ background: 'rgba(14,11,22,0.97)', border: '1px solid rgba(167,139,250,0.3)' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
              <Users className="w-4 h-4 text-white/60" />
            </div>
            <div>
              <h3 className="font-display font-bold">Play Online</h3>
              <p className="text-xs text-white/40">Family game night, anytime</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!user && (
          <button onClick={onRequireAuth} className="w-full rounded-xl py-2.5 mb-4 text-sm font-semibold" style={{ background: 'rgba(167,139,250,0.15)', color: '#c4b5fd' }}>
            Sign in to create or host a room
          </button>
        )}

        <div className="flex gap-2 mb-5">
          <button onClick={handleCreate} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold" style={{ background: 'linear-gradient(90deg,#a78bfa,#38bdf8)', color: '#0a0812' }}>
            <Plus className="w-4 h-4" /> Create Room
          </button>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code"
            maxLength={5}
            className="w-20 text-center rounded-xl bg-white/5 border border-white/10 text-sm outline-none tracking-widest"
          />
          <button onClick={handleJoin} className="flex items-center gap-1 rounded-xl px-3 text-sm font-semibold bg-white/5 text-white/70">
            <LogIn className="w-4 h-4" /> Join
          </button>
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase">Open Rooms</p>
          <button onClick={refresh} className="flex items-center gap-1 text-[11px] text-white/40">
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh List
          </button>
        </div>

        <div className="rounded-xl bg-white/5 p-6 text-center">
          {rooms.length === 0 ? (
            <>
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm font-medium">No open rooms yet</p>
              <p className="text-xs text-white/40">Create one and invite your family!</p>
            </>
          ) : (
            <div className="flex flex-col gap-2 text-left">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    if (!user) return onRequireAuth()
                    setCode(r.code)
                  }}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span>{r.code} · {r.host_name}</span>
                  <span className="text-white/40 text-xs">{r.players?.length ?? 0}/4</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
