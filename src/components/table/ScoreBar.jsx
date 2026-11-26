import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect } from 'react'
import { Menu, MessageCircle } from 'lucide-react'
import Suit from '../cards/Suit'

function CountUp({ value }) {
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => Math.round(v).toString())
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] })
    return () => c.stop()
  }, [value, mv])
  return <motion.span>{text}</motion.span>
}

function TeamPlaque({ label, score, bags, bagLimit, tone, align }) {
  const color = tone === 'us' ? '#f1d28a' : '#ff8a72'
  return (
    <div className={`panel-soft rounded-2xl px-3 py-1.5 min-w-0 flex-1 ${align === 'right' ? 'text-right' : ''}`} style={{ borderColor: tone === 'us' ? 'rgb(212 166 74 / 0.4)' : 'rgb(224 68 46 / 0.35)' }}>
      <p className="text-[10px] uppercase tracking-[0.18em] font-bold truncate" style={{ color }}>
        {label}
      </p>
      <div className={`flex items-baseline gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        <span className="font-display font-extrabold text-[22px] leading-none tabular-nums text-paper">
          <CountUp value={score} />
        </span>
        <span className="text-[10px] text-faint tabular-nums" title={`${bags} bags (penalty at ${bagLimit})`}>
          {bags}/{bagLimit} bags
        </span>
      </div>
    </div>
  )
}

export default function ScoreBar({ us, them, target, round, broken, onMenu, onChat, unread, connection }) {
  return (
    <div className="relative z-40 flex items-center gap-2 px-2 pt-[calc(0.5rem+var(--safe-t))] pb-1 w-full max-w-[760px] mx-auto">
      <TeamPlaque label="Us" tone="us" score={us.total} bags={us.bags} bagLimit={us.limit} />
      <div className="flex flex-col items-center shrink-0 px-1">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center"
          title={broken ? 'Spades are broken' : 'Spades not broken yet'}
          style={{
            background: broken ? 'radial-gradient(circle at 35% 30%, #f6dc9a, #d4a64a 60%, #8a6a2b)' : 'rgb(243 234 219 / 0.05)',
            border: `1px solid ${broken ? '#f1d28a' : 'rgb(212 166 74 / 0.3)'}`,
            boxShadow: broken ? '0 0 18px rgb(241 210 138 / 0.45)' : undefined,
            transition: 'all 400ms ease',
          }}
        >
          <Suit suit="S" size={16} color={broken ? '#1b1307' : 'rgb(243 234 219 / 0.4)'} />
        </div>
        <p className="text-[10px] text-faint mt-0.5 tabular-nums whitespace-nowrap">
          R{round} · to {target}
        </p>
      </div>
      <TeamPlaque label="Them" tone="them" score={them.total} bags={them.bags} bagLimit={them.limit} align="right" />
      <div className="flex flex-col gap-1.5 shrink-0">
        <button className="btn btn-icon !w-10 !h-10" onClick={onMenu} aria-label="Table menu">
          <Menu className="w-4 h-4" />
        </button>
        {onChat && (
          <button className="btn btn-icon !w-10 !h-10 relative" onClick={onChat} aria-label="Chat">
            <MessageCircle className="w-4 h-4" />
            {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-verm text-[9px] font-bold flex items-center justify-center text-white">{unread}</span>}
          </button>
        )}
      </div>
      {connection === 'reconnecting' && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-6 chip !text-[11px]" style={{ color: '#f6dc9a', borderColor: 'rgb(241 210 138 / 0.4)' }}>
          Reconnecting…
        </div>
      )}
    </div>
  )
}
