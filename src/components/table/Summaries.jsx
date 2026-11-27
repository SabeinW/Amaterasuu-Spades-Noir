import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Check, Crown, LogOut, RotateCcw } from 'lucide-react'
import Sheet from '../ui/Sheet'
import { SUIT_SYMBOL, nextSeat, partnerOf, teamOf } from '../../lib/engine'

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

// ── luck: what everyone was dealt ───────────────────────────────────────
const bigLabel = (id) => (id === 'JOKER_BIG' ? 'Big J' : id === 'JOKER_SMALL' ? 'Little J' : `${id.slice(0, -1)}${SUIT_SYMBOL[id.slice(-1)]}`)
const isRed = (id) => /[HD]$/.test(id)
// An even share per seat: 16 spades and 8 big cards with Jokers & Deuces, 13 and 6 without.
const fairShare = (jd) => (jd ? { spades: 4, big: 2 } : { spades: 3.25, big: 1.5 })
const teamColor = (team, myTeam) => (team === myTeam ? '#f1d28a' : '#ff8a72')
const seatOrder = (mySeat) => [mySeat, partnerOf(mySeat), nextSeat(mySeat), nextSeat(partnerOf(mySeat))]
const fmt = (n) => (Number.isInteger(n) ? n : n.toFixed(1))

// Spades and big cards dealt per seat over the rounds that recorded them.
export function luckTotals(history = [], current) {
  const rows = history.filter((h) => Array.isArray(h.spades))
  if (current && !rows.some((h) => h.round === current.round)) rows.push(current)
  const seats = [0, 1, 2, 3].map((s) => ({
    spades: rows.reduce((n, h) => n + h.spades[s], 0),
    big: rows.reduce((n, h) => n + (h.big?.[s] ?? 0), 0),
  }))
  return { rounds: rows.length, first: rows[0]?.round, last: rows[rows.length - 1]?.round, seats }
}

function TeamLuck({ label, tone, spades, big }) {
  return (
    <span>
      <span className="font-bold" style={{ color: tone }}>
        {label}
      </span>{' '}
      <b className="text-paper tabular-nums">{spades}♠</b> <span className="tabular-nums">· {big} big</span>
    </span>
  )
}

// rows: per seat { spades, big } counts → that team's totals.
const teamTotal = (rows, team) => {
  const seats = [0, 1, 2, 3].filter((s) => teamOf(s) === team)
  return { spades: seats.reduce((n, s) => n + rows[s].spades, 0), big: seats.reduce((n, s) => n + rows[s].big, 0) }
}

const teamSpades = (perSeat, team) => [0, 1, 2, 3].filter((s) => teamOf(s) === team).reduce((n, s) => n + perSeat[s], 0)

function TeamsLine({ rows, myTeam }) {
  const them = myTeam === 'A' ? 'B' : 'A'
  return (
    <div className="flex justify-between gap-2">
      <TeamLuck label="Us" tone={teamColor(myTeam, myTeam)} {...teamTotal(rows, myTeam)} />
      <TeamLuck label="Them" tone={teamColor(them, myTeam)} {...teamTotal(rows, them)} />
    </div>
  )
}

function DealtBox({ dealt, players, mySeat, myTeam, jd, tally }) {
  const fair = fairShare(jd)
  const counts = dealt.map((d) => ({ spades: d.spades, big: d.big.length }))
  return (
    <div data-luck="round" className="rounded-2xl px-3 py-2.5" style={{ background: 'rgb(0 0 0 / 0.25)', border: '1px solid rgb(212 166 74 / 0.18)' }}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="font-bold text-gold-hi text-[13px]">Dealt this round</p>
        <p className="text-[11px] text-faint">
          even share: {fmt(fair.spades)}♠ · {fmt(fair.big)} big each
        </p>
      </div>
      {seatOrder(mySeat).map((s) => {
        const d = dealt[s]
        const name = s === mySeat ? 'You' : (players.find((p) => p.seat === s)?.name ?? '—')
        return (
          <div key={s} className="flex items-center gap-2 py-[3px] text-[12.5px]">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: teamColor(teamOf(s), myTeam) }} />
            <span className="truncate w-[78px] shrink-0">{name}</span>
            <span className="font-display font-bold tabular-nums w-8 shrink-0">{d.spades}♠</span>
            <span className="flex flex-wrap gap-1 min-w-0">
              {d.big.length === 0 && <span className="text-faint">no big cards</span>}
              {d.big.map((id) => (
                <span key={id} className="rounded-md px-1.5 py-px text-[11.5px] font-bold leading-snug" style={{ background: '#f3eadb', color: isRed(id) || id === 'JOKER_BIG' ? '#b3261e' : '#1b1307' }}>
                  {bigLabel(id)}
                </span>
              ))}
            </span>
          </div>
        )
      })}
      <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[12px] text-muted">
        <TeamsLine rows={counts} myTeam={myTeam} />
      </div>
      {tally?.rounds > 1 && (
        <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[12px] text-muted">
          <p className="text-[11px] text-faint mb-0.5">
            {tally.first === 1 ? `This game so far (${tally.rounds} rounds)` : `Rounds ${tally.first}–${tally.last}`} · even share {fmt(fair.spades * 2 * tally.rounds)}♠ · {fmt(fair.big * 2 * tally.rounds)} big a team
          </p>
          <TeamsLine rows={tally.seats} myTeam={myTeam} />
        </div>
      )}
    </div>
  )
}

export function RoundSummary({ open, result, round, myTeam, players, ready, mySeat, deadline, serverNow, onContinue, online, busy, coachNotes, dealt, tally, jd }) {
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
        {dealt && <DealtBox dealt={dealt} players={players} mySeat={mySeat} myTeam={myTeam} jd={jd} tally={tally} />}
        {coachNotes?.length > 0 && (
          <div className="rounded-2xl px-3 py-2.5 text-[12.5px] leading-snug" style={{ background: 'rgb(241 210 138 / 0.08)', border: '1px solid rgb(241 210 138 / 0.28)' }}>
            <p className="font-bold text-gold-hi mb-1">How the points worked</p>
            {coachNotes.map((n) => (
              <p key={n} className="text-paper/90">
                {n}
              </p>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}

// The whole game's luck: what each player was dealt, round after round.
function GameLuck({ tally, players, mySeat, myTeam, jd }) {
  const fair = fairShare(jd)
  return (
    <div data-luck="game" className="mt-4 rounded-2xl px-3 py-2.5 text-[12.5px]" style={{ background: 'rgb(0 0 0 / 0.25)', border: '1px solid rgb(212 166 74 / 0.18)' }}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="font-bold text-gold-hi text-[13px]">Cards dealt this game</p>
        <p className="text-[11px] text-faint">
          {tally.first === 1 ? `${tally.rounds} rounds` : `rounds ${tally.first}–${tally.last}`} · even share {fmt(fair.spades * tally.rounds)}♠ · {fmt(fair.big * tally.rounds)} big each
        </p>
      </div>
      {seatOrder(mySeat).map((s) => (
        <div key={s} className="flex items-center gap-2 py-[3px]">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: teamColor(teamOf(s), myTeam) }} />
          <span className="truncate flex-1 min-w-0">{s === mySeat ? 'You' : (players.find((p) => p.seat === s)?.name ?? '—')}</span>
          <span className="font-display font-bold tabular-nums w-12 text-right">{tally.seats[s].spades}♠</span>
          <span className="tabular-nums text-muted w-14 text-right">{tally.seats[s].big} big</span>
        </div>
      ))}
      <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[12px] text-muted">
        <TeamsLine rows={tally.seats} myTeam={myTeam} />
      </div>
    </div>
  )
}

export function MatchSummary({ open, pub, myTeam, onRematch, onLeave, busy, online, players = [], mySeat = 0, tally }) {
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
        {tally?.rounds > 0 && <GameLuck tally={tally} players={players} mySeat={mySeat} myTeam={myTeam} jd={pub.rules?.jokers} />}
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
                  {tally?.rounds > 0 && (
                    <span className="text-faint text-[11.5px] w-16 text-right" title="Spades dealt: us – them">
                      {Array.isArray(h.spades) ? `${teamSpades(h.spades, myTeam)}–${teamSpades(h.spades, them)}♠` : ''}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Sheet>
    </>
  )
}
