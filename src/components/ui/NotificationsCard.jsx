// Turn push notifications on or off for this device. `banner` is the one-time
// nudge on the home screen; `row` lives in the profile. On an iPhone that
// hasn't added the app to its Home Screen it explains how, since iPhones only
// send web notifications to Home Screen apps.
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Bell, BellOff, Share, SquarePlus, X } from 'lucide-react'
import { disablePush, enablePush, markPrompted, pushState, sendTestPush, wasPrompted } from '../../lib/push'

function InstallSteps() {
  return (
    <ol className="mt-2 flex flex-col gap-1.5 text-[12.5px] text-paper/90">
      <li className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'rgb(212 166 74 / 0.2)' }}>1</span>
        Tap <Share className="w-4 h-4 text-gold-hi inline" /> Share in Safari’s toolbar.
      </li>
      <li className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'rgb(212 166 74 / 0.2)' }}>2</span>
        Choose <SquarePlus className="w-4 h-4 text-gold-hi inline" /> Add to Home Screen.
      </li>
      <li className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: 'rgb(212 166 74 / 0.2)' }}>3</span>
        Open Noir Spades from your Home Screen and turn notifications on there.
      </li>
    </ol>
  )
}

export default function NotificationsCard({ variant = 'row' }) {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [hidden, setHidden] = useState(() => variant === 'banner' && wasPrompted())

  useEffect(() => {
    if (hidden) return
    pushState().then(setState).catch(() => setState('unsupported'))
  }, [hidden])

  async function turnOn() {
    setBusy(true)
    setMsg(null)
    try {
      await enablePush()
      setState('on')
      setMsg({ ok: true, text: 'Notifications are on. Sending a test…' })
      const r = await sendTestPush().catch(() => null)
      setMsg({ ok: true, text: r?.sent ? 'Notifications are on — you should see a test one now.' : 'Notifications are on.' })
      if (variant === 'banner') setTimeout(() => setHidden(true), 3500)
    } catch (e) {
      setMsg({ ok: false, text: e.message })
      setState(await pushState().catch(() => 'off'))
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      await disablePush()
      setState('off')
      setMsg(null)
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    try {
      const r = await sendTestPush()
      setMsg({ ok: !!r?.sent, text: r?.sent ? 'Sent — check your notifications.' : r?.duplicate ? 'Just sent one — give it a moment.' : 'This device isn’t signed up. Turn notifications off and on again.' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  if (hidden || !state || state === 'unsupported') return null
  if (variant === 'banner' && (state === 'on' || state === 'denied') && !msg) return null

  const dismiss = () => {
    markPrompted()
    setHidden(true)
  }

  const Wrap = variant === 'banner' ? motion.div : 'div'
  const wrapProps = variant === 'banner' ? { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } } : {}
  return (
    <Wrap {...wrapProps} className="relative rounded-2xl px-3.5 py-3 text-left" style={{ background: 'rgb(241 210 138 / 0.07)', border: '1px solid rgb(241 210 138 / 0.28)' }}>
      {variant === 'banner' && (
        // .btn sets its own position, so the corner spot comes from a wrapper
        <span className="absolute top-2 right-2 z-10">
          <button className="btn btn-icon !w-8 !h-8 !min-h-8" onClick={dismiss} aria-label="Not now">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      )}
      <div className="flex items-start gap-3 pr-6">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgb(212 166 74 / 0.14)', border: '1px solid rgb(212 166 74 / 0.3)' }}>
          {state === 'on' ? <Bell className="w-[18px] h-[18px] text-gold-hi" /> : <BellOff className="w-[18px] h-[18px] text-gold-hi" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold leading-tight">Notifications {state === 'on' ? 'are on' : ''}</p>
          <p className="text-[12.5px] text-muted mt-0.5">
            {state === 'install'
              ? 'Get a buzz when friends invite you to a table. On iPhone, add the app to your Home Screen first:'
              : state === 'denied'
                ? 'Notifications are blocked for this app. Turn them on in your phone’s Settings → Notifications, then come back here.'
                : 'A buzz when a friend invites you to a table, sends a friend request or accepts yours.'}
          </p>
          {state === 'install' && <InstallSteps />}
        </div>
      </div>
      {(state === 'off' || state === 'on') && (
        <div className="flex gap-2 mt-3">
          {state === 'off' ? (
            <button className="btn btn-gold flex-1 !min-h-10 !text-[13.5px]" disabled={busy} onClick={turnOn}>
              <Bell className="w-4 h-4" /> Turn on notifications
            </button>
          ) : (
            <>
              <button className="btn btn-ghost flex-1 !min-h-10 !text-[13px]" disabled={busy} onClick={test}>
                Send a test
              </button>
              <button className="btn btn-ghost flex-1 !min-h-10 !text-[13px]" disabled={busy} onClick={turnOff}>
                Turn off
              </button>
            </>
          )}
        </div>
      )}
      {msg && (
        <p className="text-[12px] mt-2" style={{ color: msg.ok ? '#9ff0b0' : '#ffb4a6' }}>
          {msg.text}
        </p>
      )}
    </Wrap>
  )
}
