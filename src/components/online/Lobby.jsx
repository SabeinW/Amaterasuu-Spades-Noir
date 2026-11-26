import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { LogIn, Plus, RefreshCw, Settings2, Users } from 'lucide-react'
import Sheet from '../ui/Sheet'
import Avatar from '../ui/Avatar'
import { createTable, joinTable, listOpenRooms } from '../../lib/online'
import { listFriends } from '../../lib/social'
import { normalizeRules } from '../../lib/engine'

export function ruleChips(rulesInput) {
  const r = normalizeRules(rulesInput)
  return [`To ${r.winScore}`, r.jokers ? 'Jokers & Deuces' : 'Classic deck', r.nil ? 'Nil' : 'No nil', r.blindNil && 'Blind nil', r.boardRule && `Board ${r.boardMinimum}`, r.bagPenalty ? `${r.bagLimit} bags` : 'No bag penalty'].filter(Boolean)
}

function CodeInput({ value, onChange, onSubmit }) {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)]
  const digits = value.padEnd(4, ' ').slice(0, 4).split('')
  function set(i, ch) {
    const next = value.split('')
    next[i] = ch
    const joined = next.join('').replace(/\s/g, '').slice(0, 4)
    onChange(joined)
    if (ch && i < 3) refs[i + 1].current?.focus()
    if (joined.length === 4) onSubmit?.(joined)
  }
  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          value={d.trim()}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`Code digit ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            if (v.length > 1) {
              const all = v.slice(0, 4)
              onChange(all)
              if (all.length === 4) onSubmit?.(all)
              return
            }
            set(i, v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d.trim() && i > 0) refs[i - 1].current?.focus()
          }}
          className="w-14 h-16 text-center rounded-2xl font-display font-extrabold text-3xl outline-none transition-all"
          style={{ background: 'rgb(0 0 0 / 0.35)', border: `1px solid ${d.trim() ? '#d4a64a' : 'rgb(212 166 74 / 0.28)'}`, color: '#f6dc9a' }}
        />
      ))}
    </div>
  )
}

export default function Lobby({ open, onClose, user, profile, rules, onEditRules, onRequireAuth, onEnterRoom, initialCode = '' }) {
  const [rooms, setRooms] = useState([])
  const [friendIds, setFriendIds] = useState(new Set())
  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [loading, setLoading] = useState(false)
  const autoJoined = useRef(false)
  const name = profile?.username || user?.email?.split('@')[0] || 'Player'

  async function refresh() {
    setLoading(true)
    setRooms(await listOpenRooms())
    setLoading(false)
  }

  useEffect(() => {
    if (!open) return
    refresh()
    const t = setInterval(refresh, 8000)
    return () => clearInterval(t)
  }, [open])

  useEffect(() => {
    if (!user?.id) return
    listFriends(user.id).then(({ friends }) => setFriendIds(new Set(friends.map((f) => f.id))))
  }, [user?.id])

  // Invite links (?join=1234) join automatically — once the profile has
  // loaded, so you sit down under your username rather than your email.
  const [profileWait, setProfileWait] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setProfileWait(false), 2500)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (open && initialCode && user && (profile || !profileWait) && !autoJoined.current) {
      autoJoined.current = true
      join(initialCode)
    }
  }, [open, initialCode, user, profile, profileWait]) // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    if (!user) return onRequireAuth()
    setError(null)
    setBusy('create')
    try {
      const res = await createTable(name, rules)
      onEnterRoom(res.room)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  async function join(c) {
    if (!user) return onRequireAuth()
    if (!/^\d{4}$/.test(c)) return
    setError(null)
    setBusy(c)
    try {
      const res = await joinTable(c, name)
      onEnterRoom(res.room)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  const sorted = [...rooms].sort((a, b) => Number(friendIds.has(b.host_id)) - Number(friendIds.has(a.host_id)))

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Online" title="Play online" wide>
      {!user && (
        <div className="panel rounded-2xl p-4 mb-4 flex items-center gap-3">
          <Users className="w-8 h-8 text-gold shrink-0" />
          <p className="text-sm text-muted flex-1">Sign in so your seat, stats and rank follow you.</p>
          <button className="btn btn-gold !min-h-10" onClick={onRequireAuth}>
            <LogIn className="w-4 h-4" /> Sign in
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: 'rgb(243 234 219 / 0.03)', border: '1px solid rgb(212 166 74 / 0.22)' }}>
          <p className="eyebrow">Host a table</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5 mb-3">
            {ruleChips(rules).map((c) => (
              <span key={c} className="chip">
                {c}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-gold flex-1" disabled={!!busy} onClick={create}>
              <Plus className="w-4 h-4" /> {busy === 'create' ? 'Setting up…' : 'Create table'}
            </button>
            <button className="btn btn-icon !w-12 !h-12" onClick={onEditRules} aria-label="Edit house rules">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'rgb(243 234 219 / 0.03)', border: '1px solid rgb(212 166 74 / 0.22)' }}>
          <p className="eyebrow mb-3">Join with a code</p>
          <CodeInput value={code} onChange={setCode} onSubmit={join} />
          <button className="btn btn-ghost w-full mt-3" disabled={code.length !== 4 || !!busy} onClick={() => join(code)}>
            {busy === code ? 'Joining…' : 'Join table'}
          </button>
        </div>
      </div>

      {error && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px] text-verm-hi mt-3 text-center">
          {error}
        </motion.p>
      )}

      <div className="flex items-center justify-between mt-6 mb-2">
        <p className="eyebrow">Open tables</p>
        <button onClick={refresh} className="flex items-center gap-1.5 text-[12px] text-faint">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.length === 0 && <p className="text-[13px] text-faint text-center py-6">No open tables right now — host one and share the code.</p>}
        {sorted.map((r) => {
          const filled = r.players?.length ?? 0
          const friend = friendIds.has(r.host_id)
          return (
            <motion.button
              key={r.id}
              layout
              onClick={() => join(r.code)}
              disabled={!!busy || filled >= 4}
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left disabled:opacity-50"
              style={{ background: friend ? 'rgb(212 166 74 / 0.1)' : 'rgb(243 234 219 / 0.03)', border: `1px solid ${friend ? 'rgb(212 166 74 / 0.45)' : 'rgb(243 234 219 / 0.08)'}` }}
            >
              <Avatar name={r.host_name} size={38} ring={friend} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold truncate">
                  {r.host_name}'s table {friend && <span className="text-gold text-[11px] font-semibold ml-1">Friend</span>}
                </p>
                <p className="text-[11.5px] text-faint truncate">{ruleChips(r.settings).slice(0, 3).join(' · ')}</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="w-2 h-2 rounded-full" style={{ background: i < filled ? '#d4a64a' : 'rgb(243 234 219 / 0.15)' }} />
                ))}
              </div>
              <span className="font-display font-bold text-gold-hi tabular-nums">{r.code}</span>
            </motion.button>
          )
        })}
      </div>
    </Sheet>
  )
}
