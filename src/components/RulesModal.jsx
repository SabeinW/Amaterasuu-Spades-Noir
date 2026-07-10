import { useState } from 'react'
import { X } from 'lucide-react'
import { DEFAULT_GAME_RULES } from '../data/challenges'

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-11 h-6 rounded-full relative shrink-0 transition-colors"
      style={{ background: checked ? 'linear-gradient(90deg,#a78bfa,#38bdf8)' : 'rgba(255,255,255,0.1)' }}
    >
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: checked ? 22 : 2 }} />
    </button>
  )
}

function Row({ title, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-[11px] text-white/40 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-white/5 border border-white/10 text-xs px-2.5 py-2 outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#0e0b16]">
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] tracking-widest text-white/40 font-semibold uppercase mb-1">{title}</p>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  )
}

export default function RulesModal({ onClose, onSave, initialRules }) {
  const [rules, setRules] = useState(initialRules ?? DEFAULT_GAME_RULES)
  const set = (patch) => setRules((prev) => ({ ...prev, ...patch }))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp" style={{ background: 'rgba(12,10,20,0.98)', border: '1px solid rgba(167,139,250,0.25)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold">Game Rules</h3>
            <p className="text-xs text-white/40">Customize your play style</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <Section title="Bidding Rules">
          <Row title="Blind Nil" desc="Bid nil before seeing your hand — risky but rewarding">
            <Toggle checked={rules.blindNil} onChange={(v) => set({ blindNil: v })} />
          </Row>
          <Row title="Standard Nil" desc="Bid zero tricks after seeing your hand">
            <Toggle checked={rules.standardNil} onChange={(v) => set({ standardNil: v })} />
          </Row>
          <Row title="Double Nil" desc="Both partners bid nil for a massive bonus">
            <Toggle checked={rules.doubleNil} onChange={(v) => set({ doubleNil: v })} />
          </Row>
          <Row title="Nil Bonus">
            <Select value={rules.nilBonus} options={[{ value: 50, label: '50 pts' }, { value: 100, label: '100 pts' }, { value: 150, label: '150 pts' }]} onChange={(v) => set({ nilBonus: Number(v) })} />
          </Row>
        </Section>

        <Section title="Bags &amp; Penalties">
          <Row title="Bag Penalty" desc="10 bags = -100 points">
            <Toggle checked={rules.bagPenalty} onChange={(v) => set({ bagPenalty: v })} />
          </Row>
          <Row title="Bag Limit">
            <Select value={rules.bagLimit} options={[{ value: 5, label: '5 bags' }, { value: 10, label: '10 bags (Classic)' }]} onChange={(v) => set({ bagLimit: Number(v) })} />
          </Row>
          <Row title="Moon Shot" desc="Take all 13 tricks to win instantly">
            <Toggle checked={rules.moonShot} onChange={(v) => set({ moonShot: v })} />
          </Row>
        </Section>

        <Section title="Spades Rules">
          <Row title="Spades Always Trump" desc="Spades can be played any time (off = must follow suit)">
            <Toggle checked={rules.spadesAlwaysTrump} onChange={(v) => set({ spadesAlwaysTrump: v })} />
          </Row>
          <Row title="Spades Break Rule" desc="Must have a spade led before breaking">
            <Toggle checked={rules.spadesBreakRule} onChange={(v) => set({ spadesBreakRule: v })} />
          </Row>
          <Row title="Jokers & Deuces" desc="Big Joker, Little Joker, 2♦, 2♠ become the top trumps, in that order">
            <Toggle checked={rules.jokersWild} onChange={(v) => set({ jokersWild: v })} />
          </Row>
        </Section>

        <Section title="Scoring &amp; Win Condition">
          <Row title="Win Score">
            <Select value={rules.winScore} options={[{ value: 300, label: '300 pts (Quick)' }, { value: 500, label: '500 pts (Classic)' }, { value: 1000, label: '1000 pts (Long)' }]} onChange={(v) => set({ winScore: Number(v) })} />
          </Row>
          <Row title="Losing Score">
            <Select value={rules.losingScore} options={[{ value: -100, label: '-100 pts' }, { value: -200, label: '-200 pts' }]} onChange={(v) => set({ losingScore: Number(v) })} />
          </Row>
          <Row title="Partnership Mode" desc="North/South vs East/West team scoring">
            <Toggle checked={rules.partnershipMode} onChange={(v) => set({ partnershipMode: v })} />
          </Row>
        </Section>

        <Section title="Speed &amp; Timing">
          <Row title="Bid Timer">
            <Select value={rules.bidTimer} options={[{ value: 'none', label: 'No timer' }, { value: '15', label: '15s' }, { value: '30', label: '30s' }]} onChange={(v) => set({ bidTimer: v })} />
          </Row>
          <Row title="Play Timer">
            <Select value={rules.playTimer} options={[{ value: 'none', label: 'No timer' }, { value: '15', label: '15s' }, { value: '30', label: '30s' }]} onChange={(v) => set({ playTimer: v })} />
          </Row>
        </Section>

        <button
          onClick={() => onSave(rules)}
          className="w-full rounded-xl py-3 font-semibold text-sm mt-2"
          style={{ background: 'linear-gradient(90deg,#a78bfa,#38bdf8)', color: '#0a0812' }}
        >
          Save Rules
        </button>
      </div>
    </div>
  )
}
