import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Sheet from './ui/Sheet'
import { DEFAULT_GAME_RULES } from '../data/challenges'

const CARD = { background: 'rgb(243 234 219 / 0.03)', border: '1px solid rgb(212 166 74 / 0.22)' }

// Same reading as the engine's normalizeRules: unset means on, and a stored
// 'true'/'false' string counts as its boolean.
const onByDefault = (v) => (v === undefined || v === null || v === '' ? true : v === true || v === 'true')

// Pill track that fills with gold leaf when on; the knob springs across.
function Switch({ checked }) {
  return (
    <span
      aria-hidden="true"
      className="relative shrink-0 w-[52px] h-[30px] rounded-full transition-[border-color,box-shadow] duration-200"
      style={
        checked
          ? { background: 'var(--gold-leaf)', border: '1px solid rgb(246 220 154 / 0.75)', boxShadow: '0 6px 16px -8px rgb(212 166 74 / 0.95), inset 0 1px 0 rgb(255 255 255 / 0.45)' }
          : { background: 'rgb(0 0 0 / 0.45)', border: '1px solid rgb(212 166 74 / 0.28)', boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 0.6)' }
      }
    >
      <motion.span
        className="absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full"
        initial={false}
        animate={{ x: checked ? 22 : 0 }}
        transition={{ type: 'spring', stiffness: 560, damping: 32 }}
        style={{ background: checked ? '#fff8ea' : 'rgb(243 234 219 / 0.55)', boxShadow: '0 2px 6px rgb(0 0 0 / 0.45)' }}
      />
    </span>
  )
}

// The whole row is the switch, so the tap target is the full width.
function ToggleRow({ title, desc, checked, onChange }) {
  const on = !!checked
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="w-full min-h-[56px] flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
    >
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-paper">{title}</span>
        {desc && <span className="block text-[12px] leading-snug text-muted mt-0.5">{desc}</span>}
      </span>
      <Switch checked={on} />
    </button>
  )
}

// Segmented gold chips for short option lists (≤4). The active chip's gold
// leaf glides between options.
function Segmented({ label, value, options, onChange }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 p-1 rounded-[14px]" style={{ background: 'rgb(0 0 0 / 0.35)', border: '1px solid rgb(212 166 74 / 0.2)' }}>
      {options.map((o) => {
        const active = String(o.value) === String(value)
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="relative flex-1 min-w-0 min-h-11 rounded-[10px] px-1.5 py-1.5 flex flex-col items-center justify-center leading-tight transition-colors"
            style={{ color: active ? '#1b1307' : 'rgb(243 234 219 / 0.62)' }}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px]"
                style={{ background: 'var(--gold-leaf)', boxShadow: '0 6px 16px -8px rgb(212 166 74 / 0.9), inset 0 1px 0 rgb(255 255 255 / 0.5)' }}
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="relative font-display text-[13.5px] font-bold tabular-nums whitespace-nowrap">{o.label}</span>
            {o.hint && <span className={`relative text-[10.5px] font-semibold mt-0.5 ${active ? 'opacity-75' : 'opacity-60'}`}>{o.hint}</span>}
          </button>
        )
      })}
    </div>
  )
}

function ChoiceRow({ title, desc, value, options, onChange }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[14.5px] font-semibold text-paper">{title}</p>
      {desc && <p className="text-[12px] leading-snug text-muted mt-0.5">{desc}</p>}
      <div className="mt-2.5">
        <Segmented label={title} value={value} options={options} onChange={onChange} />
      </div>
    </div>
  )
}

// A row that only exists while its parent toggle is on.
function Reveal({ show, children }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-5 last:mb-1">
      <p className="eyebrow mb-2 px-1">{title}</p>
      <div className="rounded-2xl overflow-hidden divide-y divide-white/[0.06]" style={CARD}>
        {children}
      </div>
    </section>
  )
}

export default function RulesModal({ onClose, onSave, initialRules }) {
  const [rules, setRules] = useState(initialRules ?? DEFAULT_GAME_RULES)
  const set = (patch) => setRules((prev) => ({ ...prev, ...patch }))

  return (
    <Sheet
      open
      onClose={onClose}
      eyebrow="House rules"
      title="Game rules"
      footer={
        <button onClick={() => onSave(rules)} className="btn btn-gold w-full">
          Save rules
        </button>
      }
    >
      <p className="text-[13px] text-muted -mt-1 mb-4">Customise how your table plays.</p>

      <Section title="Bidding">
        <ToggleRow title="Blind nil" desc="Bid nil before seeing your hand — risky but rewarding" checked={rules.blindNil} onChange={(v) => set({ blindNil: v })} />
        <ToggleRow title="Standard nil" desc="Bid zero tricks after seeing your hand" checked={rules.standardNil} onChange={(v) => set({ standardNil: v })} />
        <ToggleRow title="Double nil" desc="Both partners bid nil for a massive bonus" checked={rules.doubleNil} onChange={(v) => set({ doubleNil: v })} />
        <ChoiceRow
          title="Nil bonus"
          value={rules.nilBonus}
          options={[
            { value: 50, label: '50 pts' },
            { value: 100, label: '100 pts' },
            { value: 150, label: '150 pts' },
          ]}
          onChange={(v) => set({ nilBonus: Number(v) })}
        />
        <div>
          <ToggleRow
            title="Board rule"
            desc="Partnership must bid at least the minimum combined — otherwise both partners rebid"
            checked={rules.boardRule}
            onChange={(v) => set({ boardRule: v })}
          />
          <Reveal show={!!rules.boardRule}>
            <div className="border-t border-white/[0.06]">
              <ChoiceRow
                title="Board minimum"
                value={rules.boardMinimum}
                options={[
                  { value: 3, label: '3 tricks' },
                  { value: 4, label: '4 tricks', hint: 'Classic' },
                  { value: 5, label: '5 tricks' },
                ]}
                onChange={(v) => set({ boardMinimum: Number(v) })}
              />
            </div>
          </Reveal>
        </div>
      </Section>

      <Section title="Bags & penalties">
        <ToggleRow title="Bag penalty" desc={`${rules.bagLimit ?? 10} bags = −100 points`} checked={rules.bagPenalty} onChange={(v) => set({ bagPenalty: v })} />
        <ChoiceRow
          title="Bag limit"
          value={rules.bagLimit}
          options={[
            { value: 5, label: '5 bags' },
            { value: 10, label: '10 bags', hint: 'Classic' },
          ]}
          onChange={(v) => set({ bagLimit: Number(v) })}
        />
        <ToggleRow title="Moon shot" desc="Take all 13 tricks to win instantly" checked={rules.moonShot} onChange={(v) => set({ moonShot: v })} />
      </Section>

      <Section title="Spades">
        <ToggleRow title="Spades break rule" desc="Must have a spade led before breaking" checked={rules.spadesBreakRule} onChange={(v) => set({ spadesBreakRule: v })} />
        <ToggleRow title="Jokers & Deuces" desc="Big Joker, Little Joker, 2♦, 2♠ become the top trumps, in that order" checked={rules.jokersWild} onChange={(v) => set({ jokersWild: v })} />
      </Section>

      <Section title="Scoring & win condition">
        <ChoiceRow
          title="Win score"
          value={rules.winScore}
          options={[
            { value: 300, label: '300 pts', hint: 'Quick' },
            { value: 500, label: '500 pts', hint: 'Classic' },
            { value: 1000, label: '1000 pts', hint: 'Long' },
          ]}
          onChange={(v) => set({ winScore: Number(v) })}
        />
        <ChoiceRow
          title="Losing score"
          value={rules.losingScore}
          options={[
            { value: -100, label: '−100 pts' },
            { value: -200, label: '−200 pts' },
          ]}
          onChange={(v) => set({ losingScore: Number(v) })}
        />
      </Section>

      <Section title="Speed & timing">
        <ToggleRow title="Turn timer" desc="Online: 40s to bid, 30s to play, then a bot moves for you" checked={onByDefault(rules.timers)} onChange={(v) => set({ timers: v })} />
      </Section>
    </Sheet>
  )
}
