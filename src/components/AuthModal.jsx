import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Mail, Lock, LogIn, UserPlus, Send, ArrowLeft, MailCheck } from 'lucide-react'
import Sheet from './ui/Sheet'
import { sendPasswordReset, signIn, signUp } from '../lib/auth'
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
  // 'form' (sign in / sign up), 'forgot' (ask for a reset email), 'sent'
  const [mode, setMode] = useState('form')
  const formId = useId()

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await sendPasswordReset(email)
        setMode('sent')
        return
      }
      const data = tab === 'signin' ? await signIn(email, password) : await signUp(email, password)
      onAuthed(data.user ?? data.session?.user)
    } catch (err) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const signingIn = tab === 'signin'
  const forgot = mode !== 'form'
  const backToSignIn = () => {
    setMode('form')
    setError(null)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow="Amaterasuu Noir Spades"
      title={forgot ? 'Reset your password' : signingIn ? 'Welcome back' : 'Take a seat'}
      footer={
        forgot ? (
          <div className="flex flex-col gap-2">
            {mode === 'forgot' && (
              <button type="submit" form={formId} disabled={busy || !supabaseEnabled} className="btn btn-gold w-full">
                {busy ? 'Sending…' : (
                  <>
                    <Send className="w-4 h-4" /> Email me a reset link
                  </>
                )}
              </button>
            )}
            <button type="button" onClick={backToSignIn} className="btn btn-ghost w-full">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </button>
          </div>
        ) : (
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
        )
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
          {forgot
            ? "Enter your account's email and we'll send you a link to choose a new password."
            : signingIn
              ? 'Sign in so your seat, rating and friends follow you to any table.'
              : 'Make an account to keep your rating, achievements and friends.'}
        </p>
      </div>

      {!forgot && <Tabs value={tab} onChange={setTab} />}

      {mode === 'sent' && (
        <div role="status" className="mt-2 rounded-2xl px-4 py-4 flex items-start gap-3" style={{ background: 'rgb(212 166 74 / 0.08)', border: '1px solid rgb(212 166 74 / 0.35)' }}>
          <MailCheck className="w-6 h-6 text-gold shrink-0 mt-0.5" />
          <p className="text-[13.5px] leading-relaxed text-muted">
            If <b className="text-paper">{email}</b> has an account, a reset link is on its way. Open it on this device, then choose a new password. Check your spam folder if it isn't there in a few minutes.
          </p>
        </div>
      )}

      {!supabaseEnabled && (
        <div className="mt-4 rounded-2xl px-3.5 py-3 text-[12.5px] leading-relaxed text-muted" style={{ background: 'rgb(212 166 74 / 0.07)', border: '1px solid rgb(212 166 74 / 0.3)' }}>
          <span className="font-semibold text-gold-hi">Accounts are offline. </span>
          Supabase isn't configured yet — add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to .env to enable accounts. You can still continue as a guest.
        </div>
      )}

      {mode !== 'sent' && (
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
        {!forgot && (
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
        )}
        {signingIn && !forgot && (
          <button
            type="button"
            onClick={() => {
              setMode('forgot')
              setError(null)
            }}
            className="self-end -mt-1 px-1 min-h-9 text-[12.5px] font-semibold text-gold-hi hover:underline underline-offset-4"
          >
            Forgot password?
          </button>
        )}
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
      )}
    </Sheet>
  )
}
