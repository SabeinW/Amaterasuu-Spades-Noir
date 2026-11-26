import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Check, Crown, LogOut, RotateCcw } from 'lucide-react'
import Sheet from '../ui/Sheet'

// Gold-leaf flakes drifting down — the win celebration (no music).
export function GoldLeaf({ count = 90 }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let w = (canvas.width = canvas.offsetWidth * devicePixelRatio)
    let h = (canvas.height = canvas.offsetHeight * devicePixelRatio)
    const flakes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: -Math.random() * h * 0.8,
      s: (4 + Math.random() * 9) * devicePixelRatio,
      vy: (0.6 + Math.random() * 1.4) * devicePixelRatio,
      vx: (Math.random() - 0.5) * 0.8 * devicePixelRatio,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.08,
      hue: Math.random(),
    }))
    let raf
    const start = performance.now()
    const tick = (t) => {
      ctx.clearRect(0, 0, w, h)
      const fade = Math.max(0, 1 - (t - start - 4500) / 1500)
      for (const f of flakes) {
        f.y += f.vy
        f.x += f.vx + Math.sin((t / 600) + f.a) * 0.4
        f.a += f.va
        const flip = Math.abs(Math.cos(f.a))
        ctx.save()
        ctx.translate(f.x, f.y)
        ctx.rotate(f.a)
        ctx.globalAlpha = fade * (0.55 + 0.45 * flip)
        const g = ctx.createLinearGradient(-f.s, 0, f.s, 0)
        g.addColorStop(0, f.hue > 0.85 ? '#e0442e' : '#a37a2c')
        g.addColorStop(0.5, f.hue > 0.85 ? '#ff8a72' : '#f6dc9a')
        g.addColorStop(1, f.hue > 0.85 ? '#9e2a1c' : '#d4a64a')
        ctx.fillStyle = g
        ctx.fillRect(-f.s / 2, (-f.s / 2) * flip, f.s, f.s * flip * 0.8)
        ctx.restore()
      }
      if (fade > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [count])
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 w-full h-full z-[70]" />
}

function Countdown({ deadline, serverNow }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - serverNow()))
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, deadline - serverNow())), 250)
    return () => clearInterval(t)
  }, [deadline, serverNow])
  return <span className="tabular-nums">{Math.ceil(left / 1000)}s</span>
}

function TeamLine({ label, tone, r }) {
  const color = tone === 'us' ? '#f1d28a' : '#ff8a72'
  const delta = r.delta
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgb(243 234 219 / 0.03)', border: `1px solid ${tone === 'us' ? 'rgb(212 166 74 / 0.35)' : 'rgb(224 68 46 / 0.3)'}` }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold" style={{ color }}>
          {label}
        </p>
        <motion.p
          className="font-display font-extrabold text-xl tabular-nums"
          style={{ color: delta >= 0 ? '#f6dc9a' : '#ff8a72' }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.25 }}
        >
          {delta >= 0 ? '+' : ''}
          {delta}
        </motion.p>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px] text-muted">
        {r.bid > 0 && (
          <span>
            Bid {r.bid}, took {r.taken}{' '}
            <b className={r.made ? 'text-gold-hi' : 'text-verm-hi'}>{r.made ? 'made' : 'set'}</b>
          </span>
        )}
        {r.nils.map((n) => (
          <span key={n.seat}>
            {n.blind ? 'Blind Nil' : 'Nil'} <b className={n.ok ? 'text-gold-hi' : 'text-verm-hi'}>{n.ok ? `+${n.points}` : n.points}</b>
          </span>
        ))}
        {r.bagsEarned > 0 && <span>+{r.bagsEarned} bag{r.bagsEarned > 1 ? 's' : ''}</span>}
        {r.penalty > 0 && <span className="text-verm-hi font-semibold">Bag penalty −{r.penalty}</span>}
        <span className="col-span-2 text-paper">
          Total <b className="font-display text-base">{r.total}</b> · {r.bags} bags
        </span>
      </div>
    </div>
  )
}

export function RoundSummary({ open, result, round, myTeam, players, ready, mySeat, deadline, serverNow, onContinue, online, busy }) {
  if (!result) return null
  const them = myTeam === 'A' ? 'B' : 'A'
  const iAmReady = ready?.[mySeat]
  const waitingOn = players.filter((p) => !p.isBot && !p.left && !ready?.[p.seat]).map((p) => p.name)
  return (
    <Sheet
      open={open}
      dismissable={false}
      eyebrow={`Round ${round}`}
      title={result[myTeam].delta >= result[them].delta ? 'Round to you' : 'Round to them'}
      footer={
        <div>
          {online && deadline && (
            <p className="text-center text-[12px] text-faint mb-2">
              {iAmReady ? `Waiting for ${waitingOn.join(', ') || 'the table'}` : 'Next deal'} in <Countdown deadline={deadline} serverNow={serverNow} />
            </p>
          )}
          <button className="btn btn-gold w-full" disabled={busy || iAmReady} onClick={onContinue}>
            {iAmReady ? (
              <>
                <Check className="w-4 h-4" /> Ready
              </>
            ) : (
              'Deal next round'
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-2.5">
        <TeamLine label="Us" tone="us" r={result[myTeam]} />
        <TeamLine label="Them" tone="them" r={result[them]} />
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {[0, 1, 2, 3].map((s) => {
            const p = players.find((x) => x.seat === s)
            const line = result.seats[s]
            return (
              <div key={s} className="rounded-xl px-2 py-1.5 text-center" style={{ background: 'rgb(0 0 0 / 0.25)' }}>
                <p className="text-[11px] truncate text-muted">{p?.name}</p>
                <p className="font-display font-bold text-sm tabular-nums">
                  {line.taken}/{line.bid === 0 ? (line.blind ? 'BN' : 'Nil') : line.bid}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </Sheet>
  )
}

export function MatchSummary({ open, pub, myTeam, onRematch, onLeave, busy, online }) {
  if (!pub?.winner) return null
  const won = pub.winner === myTeam
  const them = myTeam === 'A' ? 'B' : 'A'
  return (
    <>
      {open && won && <GoldLeaf />}
      <Sheet
        open={open}
        dismissable={false}
        z={65}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={onLeave}>
              <LogOut className="w-4 h-4" /> Leave
            </button>
            <button className="btn btn-gold" disabled={busy} onClick={onRematch}>
              <RotateCcw className="w-4 h-4" /> {online ? 'Rematch' : 'Play again'}
            </button>
          </div>
        }
      >
        <div className="text-center pt-2">
          <motion.div
            className="mx-auto w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: won ? 'radial-gradient(circle at 35% 30%, #fff1c9, #d4a64a 55%, #8a6a2b)' : 'radial-gradient(circle at 35% 30%, #3a332a, #1d1913 60%, #0b0a08)',
              boxShadow: won ? '0 0 60px 10px rgb(241 210 138 / 0.35)' : '0 0 0 1px rgb(212 166 74 / 0.3)',
            }}
            initial={{ scale: 0.3, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          >
            <Crown className="w-9 h-9" style={{ color: won ? '#1b1307' : 'rgb(243 234 219 / 0.5)' }} />
          </motion.div>
          <p className="eyebrow mt-4">{pub.moon ? 'Shot the moon' : 'Match over'}</p>
          <h2 className={`text-4xl font-extrabold mt-1 ${won ? 'leaf-shimmer' : 'text-paper'}`}>{won ? 'Victory' : 'Defeat'}</h2>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold">Us</p>
              <p className="font-display text-3xl font-extrabold tabular-nums">{pub.scores[myTeam].total}</p>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-verm-hi font-bold">Them</p>
              <p className="font-display text-3xl font-extrabold tabular-nums">{pub.scores[them].total}</p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <p className="eyebrow mb-2">Rounds</p>
          <div className="max-h-44 overflow-y-auto no-scrollbar rounded-xl" style={{ background: 'rgb(0 0 0 / 0.25)' }}>
            {pub.history.map((h) => {
              const mine = myTeam === 'A' ? h.A : h.B
              const theirs = myTeam === 'A' ? h.B : h.A
              return (
                <div key={h.round} className="flex items-center justify-between px-3 py-1.5 text-[13px] border-b border-white/5 last:border-0 tabular-nums">
                  <span className="text-faint">R{h.round}</span>
                  <span className={mine >= 0 ? 'text-gold-hi' : 'text-verm-hi'}>{mine >= 0 ? '+' : ''}{mine}</span>
                  <span className={theirs >= 0 ? 'text-paper/80' : 'text-verm-hi'}>{theirs >= 0 ? '+' : ''}{theirs}</span>
                </div>
              )
            })}
          </div>
        </div>
      </Sheet>
    </>
  )
}
