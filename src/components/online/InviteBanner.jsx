// "Raheem invited you to their table — Join". Shows the newest invite sent to
// you in the last 30 minutes, appears the moment a new one arrives, and joins
// the table in one tap.
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LogIn, X } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { dismissInvite, pendingInvites, subscribeInvites } from '../../lib/invites'

export default function InviteBanner({ user, onJoin }) {
  const [invite, setInvite] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    if (!user?.id) return
    pendingInvites(user.id).then((list) => setInvite(list[0] ?? null))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setInvite(null)
      return
    }
    refresh()
    const off = subscribeInvites(user.id, refresh)
    // Also look again when the app comes back to the front (phones pause sockets).
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      off()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [user?.id, refresh])

  async function join() {
    setBusy(true)
    setError(null)
    try {
      await onJoin(invite.room_code)
      await dismissInvite(invite.id)
      setInvite(null)
    } catch (e) {
      setError(e.message || "Couldn't join that table.")
    } finally {
      setBusy(false)
    }
  }

  async function dismiss() {
    const id = invite?.id
    setInvite(null)
    setError(null)
    await dismissInvite(id)
    refresh()
  }

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          key={invite.id}
          role="alert"
          className="fixed left-1/2 z-[60] w-[min(92vw,420px)]"
          style={{ top: 'calc(0.75rem + var(--safe-t))', x: '-50%' }}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <div className="panel rounded-2xl p-3 flex items-center gap-3" style={{ boxShadow: '0 18px 40px -16px rgb(0 0 0 / 0.9), 0 0 0 1px rgb(241 210 138 / 0.45)' }}>
            <Avatar avatarUrl={invite.from.avatar_url} name={invite.from.username} size={42} />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold leading-tight truncate">{invite.from.username} invited you</p>
              <p className="text-[12px] text-muted truncate">{error ?? `to their table · code ${invite.room_code}`}</p>
            </div>
            <button onClick={join} disabled={busy} className="btn btn-gold !min-h-10 !px-3.5 !rounded-full text-[13px] shrink-0">
              <LogIn className="w-4 h-4" /> {busy ? 'Joining…' : 'Join'}
            </button>
            <button onClick={dismiss} className="btn btn-icon !w-9 !h-9 shrink-0" aria-label="Not now">
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
