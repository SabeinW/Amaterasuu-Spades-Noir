import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { DECK_THEMES, MASTER_DECK_THEMES, OG_DECK_THEMES, MIDNIGHT_DECK_THEMES } from '../data/tableThemes'

const TABS = [
  { key: 'standard', label: 'Classic', list: DECK_THEMES },
  { key: 'master', label: 'Master', list: MASTER_DECK_THEMES },
  { key: 'og', label: "OG's", list: OG_DECK_THEMES },
  { key: 'midnight', label: 'Midnight', list: MIDNIGHT_DECK_THEMES },
]

function DeckSwatch({ back }) {
  return (
    <div
      className="w-9 h-12 rounded-md mb-2"
      style={{
        background: `linear-gradient(135deg, ${back.from}, ${back.to})`,
        border: `1px solid ${back.border}`,
        backgroundImage: `repeating-linear-gradient(45deg, ${back.from}33 0, ${back.from}33 2px, transparent 2px, transparent 8px)`,
      }}
    />
  )
}

export default function DeckThemesModal({ onClose, selectedId, onSelect }) {
  const [tab, setTab] = useState('standard')
  const active = TABS.find((t) => t.key === tab) ?? TABS[0]
  const isPremium = tab !== 'standard'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp" style={{ background: 'rgba(12,10,20,0.98)', border: '1px solid rgba(56,189,248,0.25)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold">Deck Themes</h3>
            <p className="text-xs text-white/40">Choose how your cards look</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1.5 mb-4 rounded-xl bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors"
              style={{ background: tab === t.key ? 'rgba(56,189,248,0.25)' : 'transparent', color: tab === t.key ? '#fff' : 'rgba(255,255,255,0.5)' }}
            >
              {t.label} <span className="opacity-50">({t.list.length})</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {active.list.map((d) => {
            const isActive = selectedId === d.id
            const accent = isPremium ? (d.metal ?? d.back.from) : '#38bdf8'
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d)}
                className="rounded-xl p-3 text-left relative"
                style={{ background: isActive ? `${accent}22` : 'rgba(255,255,255,0.04)', border: isActive ? `1px solid ${accent}aa` : '1px solid transparent' }}
              >
                {isActive && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: accent }}>
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}
                {isPremium && d.tag && (
                  <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${accent}33`, color: accent }}>
                    {d.tag}
                  </span>
                )}
                <div className={isPremium ? 'mt-6' : ''}>
                  <DeckSwatch back={d.back} />
                </div>
                <p className="text-sm font-semibold mb-1">{d.name}</p>
                <p className="text-[11px] text-white/40 leading-snug">{d.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
