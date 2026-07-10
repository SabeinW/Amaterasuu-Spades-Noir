import { useState } from 'react'
import { X, Mail, Lock } from 'lucide-react'
import { signIn, signUp } from '../lib/auth'
import { supabaseEnabled } from '../lib/supabase'

export default function AuthModal({ onClose, onAuthed, onGuest }) {
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl p-6 animate-fadeUp overflow-hidden" style={{ background: 'rgba(14,11,22,0.97)', border: '1px solid rgba(167,139,250,0.35)' }}>
        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #a78bfa, #38bdf8, #ec4899)' }} />
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white/80">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, #a78bfa, #38bdf8)' }}>
            ♠
          </div>
          <div>
            <h3 className="font-display font-bold">Welcome Back</h3>
            <p className="text-xs text-white/40">Sign in to play Amaterasuu Noir Spades</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-white/5 p-1 mb-5">
          {['signin', 'signup'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
              style={{ background: tab === t ? 'rgba(167,139,250,0.25)' : 'transparent', color: tab === t ? '#e9e2ff' : 'rgba(255,255,255,0.4)' }}
            >
              {t === 'signin' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {!supabaseEnabled && (
          <p className="text-xs text-amber-300/80 bg-amber-400/10 rounded-lg px-3 py-2 mb-4">
            Supabase isn't configured yet — add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to .env to enable accounts. You can still continue as a guest.
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <Mail className="w-4 h-4 text-white/30" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/25"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
            <Lock className="w-4 h-4 text-white/30" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/25"
            />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy || !supabaseEnabled}
            className="rounded-xl py-2.5 font-semibold text-sm disabled:opacity-40"
            style={{ background: 'linear-gradient(90deg, #a78bfa, #38bdf8)', color: '#0a0812' }}
          >
            {busy ? 'Please wait…' : '✨ Enter the Game'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[11px] text-white/30">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <button onClick={onGuest} className="w-full rounded-xl py-2.5 text-sm font-semibold bg-white/5 text-white/70">
          Continue as Guest
        </button>
      </div>
    </div>
  )
}
