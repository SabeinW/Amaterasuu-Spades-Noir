import { motion } from 'motion/react'
import { useState } from 'react'
import { Eye, EyeOff, GraduationCap } from 'lucide-react'

// Bidding panel, docked above your hand. Shows partner's bid, the board
// minimum, and a suggested bid from the same trick estimate the bots use.
export default function BidSheet({ minBid, nilAllowed, blindAllowed, revealed, partnerBid, partnerName, suggested, coach, onBid, onReveal, busy }) {
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
      {coach && <BidCoach coach={coach} />}
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

// The practice coach's reading of your hand: which cards should win and why.
function BidCoach({ coach }) {
  const [more, setMore] = useState(false)
  const shown = more ? coach.reasons : coach.reasons.slice(0, 3)
  return (
    <div className="rounded-2xl px-3 py-2.5 mb-3 text-[12.5px] leading-snug" style={{ background: 'rgb(241 210 138 / 0.08)', border: '1px solid rgb(241 210 138 / 0.28)' }}>
      <p className="flex items-center gap-1.5 font-bold text-gold-hi">
        <GraduationCap className="w-4 h-4" /> Coach: bid {coach.bid}
      </p>
      {coach.reasons.length ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {shown.map((r, i) => (
            <li key={i} className="text-paper/90">
              {r.cards.length ? <b className="text-paper">{r.cards.map((c) => c.label).join(' ')}: </b> : '• '}
              {r.text}
            </li>
          ))}
          {coach.reasons.length > 3 && (
            <li>
              <button type="button" className="text-gold font-semibold" onClick={() => setMore((m) => !m)}>
                {more ? 'Show less' : `+${coach.reasons.length - 3} more`}
              </button>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-1 text-paper/90">No sure winners in this hand — bid low.</p>
      )}
      {coach.notes.map((n) => (
        <p key={n} className="mt-1.5 text-muted">
          {n}
        </p>
      ))}
      {coach.nilIdea && <p className="mt-1.5 text-verm-hi font-semibold">Weak hand: you could bid Nil — take zero tricks for +{coach.nilBonus}, but one trick costs you {coach.nilBonus}.</p>}
    </div>
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
