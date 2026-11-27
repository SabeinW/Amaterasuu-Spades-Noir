import { AnimatePresence, motion } from 'motion/react'
import { Bot, WifiOff } from 'lucide-react'
import Avatar from '../ui/Avatar'

// Countdown ring drawn around the avatar while it's this seat's turn.
function TurnRing({ size, deadline, total, serverNow }) {
  if (!deadline) {
    return (
      <span className="turn-pulse absolute inset-0 pointer-events-none" />
    )
  }
  const remaining = Math.max(0, deadline - serverNow())
  const f0 = Math.min(1, remaining / total)
  const r = size / 2 + 3
  const urgent = remaining < 8000
  return (
    // its own layer (will-change), so redrawing the ring doesn't repaint the table under it
    <svg className="absolute pointer-events-none" width={size + 10} height={size + 10} style={{ left: -5, top: -5, transform: 'rotate(-90deg)', willChange: 'transform' }}>
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

// A thrown emoji pops off the avatar with a wiggle. The top seat sits under
// the score bar, so its emoji drops down instead of up.
function EmojiPop({ slot, emoji }) {
  const dir = slot === 'top' ? 1 : -1
  return (
    <span className="absolute left-1/2 top-1/2 pointer-events-none z-20" style={{ transform: 'translate(-50%, -50%)' }}>
      <motion.span
        className="block text-[38px] leading-none"
        style={{ textShadow: '0 4px 10px rgb(0 0 0 / 0.6)' }}
        initial={{ opacity: 0, y: 0, scale: 0.3, rotate: 0 }}
        animate={{ opacity: 1, y: dir * 44, scale: [0.3, 1.35, 1.1], rotate: [0, -14, 10, -6, 0] }}
        exit={{ opacity: 0, y: dir * 70, scale: 0.9 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {emoji}
      </motion.span>
    </span>
  )
}

// A trash-talk line: a speech bubble beside the seat, pointing into the table.
const BUBBLE_AT = {
  top: { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' },
  bottom: { bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' },
  left: { left: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
  right: { right: 'calc(100% + 8px)', top: '50%', transform: 'translateY(-50%)' },
}
const BUBBLE_FROM = { top: { y: -8 }, bottom: { y: 8 }, left: { x: -8 }, right: { x: 8 } }
function LineBubble({ slot, emote }) {
  return (
    <span className="absolute pointer-events-none z-30" style={BUBBLE_AT[slot]}>
      <motion.span
        className="block w-max max-w-[168px] rounded-2xl px-3 py-2 text-[13px] font-bold leading-snug"
        style={{ background: '#f6ecd6', color: '#1b1307', boxShadow: '0 10px 24px -6px rgb(0 0 0 / 0.7), 0 0 0 1px rgb(241 210 138 / 0.9)' }}
        initial={{ opacity: 0, scale: 0.6, ...BUBBLE_FROM[slot] }}
        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 520, damping: 22 }}
      >
        {emote.text} <span className="text-[15px]">{emote.emoji}</span>
      </motion.span>
    </span>
  )
}

export default function Seat({ slot, player, avatarUrl, bid, blind, tricks, burst, isTurn, isDealer, isPartner, deadline, total, serverNow, phase, emote, online = true, compact = false }) {
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
        {/* a won trick just landed here */}
        {burst && (
          <motion.span
            key={burst}
            className="absolute rounded-full pointer-events-none"
            style={{ inset: -4 }}
            initial={{ opacity: 1, scale: 0.85, boxShadow: '0 0 0 3px #f1d28a, 0 0 28px 10px rgb(241 210 138 / 0.75)' }}
            animate={{ opacity: 0, scale: 1.7, boxShadow: '0 0 0 1px #f1d28a, 0 0 40px 16px rgb(241 210 138 / 0)' }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        )}
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
        <AnimatePresence>{emote && (emote.kind === 'l' ? <LineBubble key={emote.id} slot={slot} emote={emote} /> : <EmojiPop key={emote.id} slot={slot} emoji={emote.emoji} />)}</AnimatePresence>
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
            <motion.span key={`${bidLabel}-${tricks}`} initial={{ scale: 1.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }}>
              <motion.span
                className="font-bold"
                initial={{ color: tricks ? '#f6dc9a' : '#f3eadb' }}
                animate={{ color: '#f3eadb' }}
                transition={{ duration: 1.2 }}
              >
                {tricks ?? 0}
              </motion.span>
              <span className="opacity-60">/{bidLabel}</span>
            </motion.span>
          )}
        </div>
      </div>
    </div>
  )
}
