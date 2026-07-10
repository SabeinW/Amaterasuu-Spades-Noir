import { X, Check } from 'lucide-react'
import { DECK_THEMES } from '../data/tableThemes'

export default function DeckThemesModal({ onClose, selectedId, onSelect }) {
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
        <div className="grid grid-cols-2 gap-3">
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
                <div
                  className="w-9 h-12 rounded-md mb-2"
                  style={{
                    background: `linear-gradient(135deg, ${d.back.from}, ${d.back.to})`,
                    border: `1px solid ${d.back.border}`,
                    backgroundImage: `repeating-linear-gradient(45deg, ${d.back.from}33 0, ${d.back.from}33 2px, transparent 2px, transparent 8px)`,
                  }}
                />
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
