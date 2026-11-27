// Opens when you arrive from a "reset your password" email: the link has
// already signed you in, so you just choose a new password.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, KeyRound, Lock } from 'lucide-react'
import Sheet from './ui/Sheet'
import { updatePassword } from '../lib/auth'

export default function NewPasswordModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('Use at least 6 characters.')
    if (password !== confirm) return setError("Those passwords don't match.")
    setBusy(true)
    try {
      await updatePassword(password)
      setDone(true)
    } catch (err) {
      setError(err.message ?? "Couldn't save the new password.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow="Account"
      title={done ? 'Password changed' : 'Choose a new password'}
      footer={
        done ? (
          <button type="button" onClick={onClose} className="btn btn-gold w-full">
            <Check className="w-4 h-4" /> Back to the game
          </button>
        ) : (
          <button type="submit" form="new-password" disabled={busy} className="btn btn-gold w-full">
            {busy ? 'Saving…' : (
              <>
                <KeyRound className="w-4 h-4" /> Save new password
              </>
            )}
          </button>
        )
      }
    >
      {done ? (
        <p className="text-[14px] text-muted leading-relaxed">You're signed in, and your new password works from now on, on any device.</p>
      ) : (
        <form id="new-password" onSubmit={submit} className="flex flex-col gap-3">
          {['New password', 'Type it again'].map((label, i) => (
            <label key={label} className="relative block">
              <span className="sr-only">{label}</span>
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/70 pointer-events-none" />
              <input
                type="password"
                required
                autoFocus={i === 0}
                autoComplete="new-password"
                value={i === 0 ? password : confirm}
                onChange={(e) => (i === 0 ? setPassword : setConfirm)(e.target.value)}
                placeholder={label}
                className="field !pl-11 text-base placeholder:text-faint"
              />
            </label>
          ))}
          <AnimatePresence>
            {error && (
              <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[13px] text-verm-hi">
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </form>
      )}
      <div aria-hidden="true" style={{ height: 'var(--safe-b)' }} />
    </Sheet>
  )
}
