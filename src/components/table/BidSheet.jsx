import { motion } from 'motion/react'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Bidding panel, docked above your hand. Shows partner's bid, the board
// minimum, and a suggested bid from the same trick estimate the bots use.
export default function BidSheet({ minBid, nilAllowed, blindAllowed, revealed, partnerBid, partnerName, suggested, onBid, onReveal, busy }) {
  const [pick, setPick] = useState(null)
  const nums = Array.from({ length: 13 }, (_, i) => i + 1)

  if (blindAllowed && !revealed) {
    return (
      <motion.div className="panel rounded-3xl p-4 mx-auto w-[min(94vw,460px)]" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <p className="eyebrow text-center">Your bid</p>
        <p className="text-center text-sm text-muted mt-1 mb-3">Blind Nil is on: bid Nil before you look and it scores double.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-verm" disabled={busy} onClick={() => onBid(0, true)}>
            <EyeOff className="w-4 h-4" /> Blind Nil ×2
          </button>
          <button className="btn btn-gold" onClick={onReveal}>
            <Eye className="w-4 h-4" /> Look at cards
          </button>
        </div>
      </motion.div>
    )
  }

  const value = pick ?? suggested ?? minBid
  return (
    <motion.div className="panel rounded-3xl p-4 mx-auto w-[min(94vw,520px)]" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}>
      <div className="flex items-baseline justify-between mb-3">
        <p className="eyebrow">Your bid</p>
        <p className="text-[12px] text-muted">
          {partnerBid === null || partnerBid === undefined ? (
            <>{partnerName} hasn't bid yet</>
          ) : (
            <>
              {partnerName} bid <span className="text-gold-hi font-bold">{partnerBid === 0 ? 'Nil' : partnerBid}</span>
              {minBid > 1 && <> · team needs {minBid}+</>}
            </>
          )}
        </p>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {nilAllowed && (
          <BidChip label="Nil" active={value === 0} onClick={() => setPick(0)} wide />
        )}
        {nums.map((n) => (
          <BidChip key={n} label={n} active={value === n} disabled={n < minBid} suggested={n === suggested} onClick={() => setPick(n)} />
        ))}
      </div>
      <button className="btn btn-gold w-full mt-3 text-[15px]" disabled={busy} onClick={() => onBid(value, false)}>
        Bid {value === 0 ? 'Nil' : value}
      </button>
    </motion.div>
  )
}

function BidChip({ label, active, disabled, suggested, onClick, wide }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative h-11 rounded-xl font-display font-extrabold text-[17px] transition-all ${wide ? 'col-span-1' : ''}`}
      style={{
        background: active ? 'linear-gradient(135deg,#f6dc9a,#d4a64a)' : 'rgb(243 234 219 / 0.05)',
        color: active ? '#1b1307' : disabled ? 'rgb(243 234 219 / 0.2)' : '#f3eadb',
        border: `1px solid ${active ? '#f1d28a' : 'rgb(212 166 74 / 0.22)'}`,
        transform: active ? 'translateY(-1px)' : undefined,
      }}
    >
      {label}
      {suggested && !active && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-gold" title="Suggested" />}
    </button>
  )
}
