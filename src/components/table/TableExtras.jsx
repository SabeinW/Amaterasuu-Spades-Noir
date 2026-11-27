import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Layers, LogOut, Palette, Send, User, Volume2, VolumeX, BookOpen, GraduationCap } from 'lucide-react'
import Sheet from '../ui/Sheet'
import { EmotePicker } from './EmotePicker'

export function TableMenu({ open, onClose, muted, onToggleMute, onDeck, onTable, onProfile, onRules, onLeave, code, deckName, tableName, coachOn, onToggleCoach }) {
  const row = 'flex items-center gap-3 w-full rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-white/5'
  return (
    <Sheet open={open} onClose={onClose} eyebrow={code ? `Table ${code}` : 'Practice table'} title="Table menu">
      <div className="flex flex-col gap-1">
        <button className={row} onClick={onToggleMute}>
          {muted ? <VolumeX className="w-5 h-5 text-gold" /> : <Volume2 className="w-5 h-5 text-gold" />}
          <span className="flex-1 font-semibold">Sound</span>
          <span className="text-faint text-sm">{muted ? 'Off' : 'On'}</span>
        </button>
        {onToggleCoach && (
          <button className={row} onClick={onToggleCoach}>
            <GraduationCap className="w-5 h-5 text-gold" />
            <span className="flex-1 font-semibold">
              Coach tips
              <span className="block text-[12px] text-faint font-normal">Suggests every bid and card, and says why</span>
            </span>
            <span className="text-faint text-sm">{coachOn ? 'On' : 'Off'}</span>
          </button>
        )}
        <button className={row} onClick={onDeck}>
          <Layers className="w-5 h-5 text-gold" />
          <span className="flex-1 font-semibold">Deck</span>
          <span className="text-faint text-sm truncate max-w-[45%]">{deckName}</span>
        </button>
        <button className={row} onClick={onTable}>
          <Palette className="w-5 h-5 text-gold" />
          <span className="flex-1 font-semibold">Table</span>
          <span className="text-faint text-sm truncate max-w-[45%]">{tableName}</span>
        </button>
        <button className={row} onClick={onRules}>
          <BookOpen className="w-5 h-5 text-gold" />
          <span className="flex-1 font-semibold">Rules at this table</span>
        </button>
        {onProfile && (
          <button className={row} onClick={onProfile}>
            <User className="w-5 h-5 text-gold" />
            <span className="flex-1 font-semibold">Edit profile</span>
          </button>
        )}
        <div className="gold-rule my-2" />
        <button className={`${row} text-verm-hi`} onClick={onLeave}>
          <LogOut className="w-5 h-5" />
          <span className="flex-1 font-semibold">Leave table</span>
        </button>
      </div>
    </Sheet>
  )
}

export function RulesSummary({ open, onClose, rules }) {
  if (!rules) return null
  const items = [
    ['Play to', `${rules.winScore} points`],
    ['Losing floor', `${rules.losingScore} points`],
    ['Jokers & Deuces', rules.jokers ? 'On — Big Joker, Little Joker, 2♦, 2♠ top the trumps' : 'Off'],
    ['Nil', rules.nil ? `On (±${rules.nilBonus})` : 'Off'],
    ['Blind Nil', rules.blindNil ? `On (±${rules.nilBonus * 2})` : 'Off'],
    ['Double Nil', rules.doubleNil ? 'Allowed' : 'Not allowed'],
    ['Board rule', rules.boardRule ? `Team bids at least ${rules.boardMinimum}` : 'Off'],
    ['Bags', rules.bagPenalty ? `−100 every ${rules.bagLimit}` : 'No penalty'],
    ['Spades', rules.spadesBreak ? 'Must be broken before leading' : 'Lead any time'],
    ['Moon shot', rules.moonShot ? 'All 13 tricks wins instantly' : 'Off'],
    ['Turn timer', rules.timers ? '40s to bid, 30s to play' : 'Off'],
  ]
  return (
    <Sheet open={open} onClose={onClose} eyebrow="House rules" title="Rules at this table" z={70}>
      <dl className="divide-y divide-white/5">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5 text-[13.5px]">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  )
}

export function ChatSheet({ open, onClose, messages, onSend, onEmote }) {
  const [text, setText] = useState('')
  const endRef = useRef(null)
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' })
  }, [open, messages.length])
  function submit(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSend(t.slice(0, 200))
    setText('')
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Table talk"
      title="Chat"
      footer={
        <div>
          <div className="mb-2.5">
            <EmotePicker variant="row" onPick={onEmote} />
          </div>
          <form onSubmit={submit} className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Talk your talk…" className="field" maxLength={200} />
            <button className="btn btn-gold !px-4" aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      }
    >
      <div className="flex flex-col gap-2 min-h-[160px]">
        {messages.length === 0 && <p className="text-faint text-sm text-center mt-8">No messages yet.</p>}
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13.5px] ${m.mine ? 'self-end' : 'self-start'}`} style={{ background: m.mine ? 'rgb(212 166 74 / 0.16)' : 'rgb(243 234 219 / 0.05)' }}>
            {!m.mine && <p className="text-[11px] font-bold text-gold mb-0.5">{m.author}</p>}
            {m.text}
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>
    </Sheet>
  )
}
