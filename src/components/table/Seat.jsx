import { AnimatePresence, motion } from 'motion/react'
import { Bot, WifiOff } from 'lucide-react'
import Avatar from '../ui/Avatar'

// Countdown ring drawn around the avatar while it's this seat's turn.
function TurnRing({ size, deadline, total, serverNow }) {
  if (!deadline) {
    return (
      <span className="absolute inset-0 rounded-full" style={{ animation: 'turnPulse 1.6s ease-in-out infinite' }} />
    )
  }
  const remaining = Math.max(0, deadline - serverNow())
  const f0 = Math.min(1, remaining / total)
  const r = size / 2 + 3
  const urgent = remaining < 8000
  return (
    <svg className="absolute pointer-events-none" width={size + 10} height={size + 10} style={{ left: -5, top: -5, transform: 'rotate(-90deg)' }}>
      <circle cx={(size + 10) / 2} cy={(size + 10) / 2} r={r} fill="none" stroke="rgb(0 0 0 / 0.45)" strokeWidth="3" />
      <motion.circle
        key={deadline}
        cx={(size + 10) / 2}
        cy={(size + 10) / 2}
        r={r}
        fill="none"
        stroke={urgent ? '#ff6a4f' : '#f1d28a'}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: f0 }}
        animate={{ pathLength: 0 }}
        transition={{ duration: remaining / 1000, ease: 'linear' }}
      />
    </svg>
  )
}

export default function Seat({ slot, player, avatarUrl, bid, blind, tricks, isTurn, isDealer, isPartner, deadline, total, serverNow, phase, emote, online = true, compact = false }) {
  const size = compact ? 40 : 52
  const bidLabel = bid === null || bid === undefined ? null : bid === 0 ? (blind ? 'Blind Nil' : 'Nil') : bid
  const away = player?.left
  const isBot = player?.isBot
  const vertical = slot === 'left' || slot === 'right'

  return (
    <div className={`relative flex ${vertical ? 'flex-col' : 'flex-row'} items-center gap-2`} style={{ opacity: away ? 0.6 : 1 }}>
      <div className="relative" style={{ width: size, height: size }}>
        <Avatar avatarUrl={avatarUrl} name={player?.name} bot={isBot} size={size} />
        {isTurn && phase !== 'round_over' && <TurnRing size={size} deadline={deadline} total={total} serverNow={serverNow} />}
        {isDealer && (
          <span
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold font-display"
            style={{ background: 'linear-gradient(135deg,#f6dc9a,#d4a64a)', color: '#1b1307', boxShadow: '0 2px 6px rgb(0 0 0 / 0.6)' }}
            title="Dealer"
          >
            D
          </span>
        )}
        {(away || !online) && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center bg-ink-3 border border-white/15" title={away ? 'Away — a bot is covering' : 'Offline'}>
            <WifiOff className="w-3 h-3 text-verm-hi" />
          </span>
        )}
        <AnimatePresence>
          {emote && (
            <motion.span
              key={emote.id}
              className="absolute left-1/2 -top-2 text-3xl pointer-events-none"
              initial={{ opacity: 0, y: 0, x: '-50%', scale: 0.5 }}
              animate={{ opacity: 1, y: -34, x: '-50%', scale: 1.1 }}
              exit={{ opacity: 0, y: -60, x: '-50%', scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {emote.emoji}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className={`panel-soft rounded-xl px-2.5 py-1.5 ${vertical ? 'text-center' : ''}`} style={{ minWidth: 78, borderColor: isTurn ? 'rgb(241 210 138 / 0.55)' : undefined }}>
        <div className="flex items-center gap-1 justify-center">
          {isBot && <Bot className="w-3 h-3 text-gold shrink-0" />}
          <p className="text-[12px] font-bold truncate max-w-[92px]" style={{ color: isTurn ? '#f6dc9a' : '#f3eadb' }}>
            {player?.name ?? '—'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-0.5 text-[11px] text-muted tabular-nums">
          {isPartner && <span className="text-gold font-semibold">Partner</span>}
          {isPartner && <span className="opacity-40">·</span>}
          {bidLabel === null ? (
            <span className="italic opacity-70">{phase === 'bidding' ? (isTurn ? 'bidding…' : 'waiting') : '—'}</span>
          ) : (
            <motion.span key={`${bidLabel}`} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>
              <span className="text-paper font-bold">{tricks ?? 0}</span>
              <span className="opacity-60">/{bidLabel}</span>
            </motion.span>
          )}
        </div>
      </div>
    </div>
  )
}
