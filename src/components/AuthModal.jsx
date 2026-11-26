import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react'
import Sheet from './ui/Sheet'
import { signIn, signUp } from '../lib/auth'
import { supabaseEnabled } from '../lib/supabase'

const TABS = [
  { id: 'signin', label: 'Sign in' },
  { id: 'signup', label: 'Sign up' },
]

function Tabs({ value, onChange }) {
  const id = useId()
  return (
    <div role="tablist" aria-label="Account" className="flex gap-1 p-1 rounded-[14px]" style={{ background: 'rgb(0 0 0 / 0.35)', border: '1px solid rgb(212 166 74 / 0.2)' }}>
      {TABS.map((t) => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="relative flex-1 min-h-11 rounded-[10px] text-[14px] font-bold transition-colors"
            style={{ color: active ? '#1b1307' : 'rgb(243 234 219 / 0.62)' }}
          >
            {active && (
              <motion.span
                layoutId={`auth-tab-${id}`}
                className="absolute inset-0 rounded-[10px]"
                style={{ background: 'var(--gold-leaf)', boxShadow: '0 6px 16px -8px rgb(212 166 74 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.5)' }}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function AuthModal({ onClose, onAuthed, onGuest }) {
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const formId = useId()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const data = tab === 'signin' ? await signIn(email, password) : await signUp(email, password)
      onAuthed(data.user ?? data.session?.user)
    } catch (err) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const signingIn = tab === 'signin'

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow="Amaterasuu Noir Spades"
      title={signingIn ? 'Welcome back' : 'Take a seat'}
      footer={
        <div className="flex flex-col gap-2">
          <button type="submit" form={formId} disabled={busy || !supabaseEnabled} className="btn btn-gold w-full">
            {busy ? (
              'Please wait…'
            ) : signingIn ? (
              <>
                <LogIn className="w-4 h-4" /> Enter the game
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Create account
              </>
            )}
          </button>
          <button type="button" onClick={onGuest} className="btn btn-ghost w-full">
            Continue as guest
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-3.5 mb-4">
        {/* Vermilion hanko seal */}
        <div
          aria-hidden="true"
          className="w-12 h-12 shrink-0 rounded-[12px] flex items-center justify-center font-display text-2xl text-washi rotate-[-4deg]"
          style={{ background: 'linear-gradient(160deg, #ef5a41 0%, #c7361f 100%)', boxShadow: '0 10px 22px -10px rgb(224 68 46 / 0.85), inset 0 0 0 2px rgb(255 244 238 / 0.22)' }}
        >
          ♠
        </div>
        <p className="text-[13.5px] leading-snug text-muted">
          {signingIn ? 'Sign in so your seat, rating and friends follow you to any table.' : 'Make an account to keep your rating, achievements and friends.'}
        </p>
      </div>

      <Tabs value={tab} onChange={setTab} />

      {!supabaseEnabled && (
        <div className="mt-4 rounded-2xl px-3.5 py-3 text-[12.5px] leading-relaxed text-muted" style={{ background: 'rgb(212 166 74 / 0.07)', border: '1px solid rgb(212 166 74 / 0.3)' }}>
          <span className="font-semibold text-gold-hi">Accounts are offline. </span>
          Supabase isn't configured yet — add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to .env to enable accounts. You can still continue as a guest.
        </div>
      )}

      <form id={formId} onSubmit={submit} className="flex flex-col gap-3 mt-4">
        <label className="relative block">
          <span className="sr-only">Email address</span>
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/70 pointer-events-none" />
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="field !pl-11 text-base placeholder:text-faint"
          />
        </label>
        <label className="relative block">
          <span className="sr-only">Password</span>
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gold/70 pointer-events-none" />
          <input
            type="password"
            required
            autoComplete={signingIn ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="field !pl-11 text-base placeholder:text-faint"
          />
        </label>
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-[13px] text-verm-hi"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </form>
    </Sheet>
  )
}
