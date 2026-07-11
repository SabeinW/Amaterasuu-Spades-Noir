import { useState } from 'react'
import { X, Check, ArrowRight } from 'lucide-react'
import { DECK_THEMES, MASTER_DECK_THEMES } from '../data/tableThemes'

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
  const [view, setView] = useState('standard')

  if (view === 'master') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-fadeUp" style={{ background: 'rgba(12,10,20,0.98)', border: '1px solid rgba(56,189,248,0.25)' }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-display font-bold text-lg">{MASTER_DECK_THEMES.length} Master Decks</h3>
              <p className="text-xs text-white/40">Hand-crafted premium card backs</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView('standard')} className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-white/60 flex items-center gap-1">
                Classic <ArrowRight className="w-3 h-3" />
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {MASTER_DECK_THEMES.map((d) => {
              const active = selectedId === d.id
              return (
                <button
                  key={d.id}
                  onClick={() => onSelect(d)}
                  className="rounded-xl p-3 text-left relative"
                  style={{ background: active ? `${d.back.from}22` : 'rgba(255,255,255,0.04)', border: active ? `1px solid ${d.back.from}aa` : '1px solid transparent' }}
                >
                  {active && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: d.back.from }}>
                      <Check className="w-3 h-3 text-black" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${d.back.from}33`, color: d.back.from }}>
                    {d.tag}
                  </span>
                  <div className="mt-6">
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
        <div className="grid grid-cols-2 gap-3 mb-4">
          {DECK_THEMES.map((d) => {
            const active = selectedId === d.id
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d)}
                className="rounded-xl p-3 text-left relative"
                style={{ background: active ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)', border: active ? '1px solid rgba(56,189,248,0.6)' : '1px solid transparent' }}
              >
                {active && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-sky-400 flex items-center justify-center">
                    <Check className="w-3 h-3 text-black" />
                  </div>
                )}
                <DeckSwatch back={d.back} />
                <p className="text-sm font-semibold mb-1">{d.name}</p>
                <p className="text-[11px] text-white/40 leading-snug">{d.description}</p>
              </button>
            )
          })}
        </div>

        <button onClick={() => setView('master')} className="w-full rounded-xl py-2.5 text-sm font-semibold bg-white/5 text-white/70 flex items-center justify-center gap-1.5">
          View {MASTER_DECK_THEMES.length} Master Decks <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
