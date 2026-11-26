// Deck and table pickers (used from the home screen and from the table menu).
import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { Check, ImagePlus, Trash2 } from 'lucide-react'
import Sheet from './ui/Sheet'
import Card from './cards/Card'
import { ALL_TABLES, DECK_FAMILIES, MAX_CUSTOM_TABLES, customTableTheme, fileToTableBackgroundDataUrl } from '../data/tableThemes'

const SAMPLE = [
  { suit: 'S', value: 'A', id: 'AS' },
  { suit: 'H', value: 'Q', id: 'QH' },
  { suit: 'D', value: '7', id: '7D' },
]

export function DeckPicker({ open, selectedId, onSelect, onClose }) {
  const [family, setFamily] = useState(() => DECK_FAMILIES.find((f) => f.decks.some((d) => d.id === selectedId))?.id ?? 'standard')
  const decks = DECK_FAMILIES.find((f) => f.id === family)?.decks ?? []
  const current = DECK_FAMILIES.flatMap((f) => f.decks).find((d) => d.id === selectedId)
  return (
    <Sheet open={open} onClose={onClose} eyebrow="Decks" title="Choose your deck" wide>
      {current && (
        <div className="flex items-end justify-center gap-2 mb-4 h-[120px]">
          <Card faceDown deck={current} width={70} style={{ transform: 'rotate(-8deg) translateY(6px)' }} />
          {SAMPLE.map((c, i) => (
            <Card key={c.id} card={c} deck={current} width={70} style={{ transform: `rotate(${(i - 1) * 5}deg)` }} />
          ))}
        </div>
      )}
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {DECK_FAMILIES.map((f) => (
          <button
            key={f.id}
            onClick={() => setFamily(f.id)}
            className="chip !text-[12px] !py-1.5 !px-3 shrink-0"
            style={family === f.id ? { background: 'linear-gradient(135deg,#f6dc9a,#d4a64a)', color: '#1b1307', borderColor: '#f1d28a' } : undefined}
          >
            {f.label} · {f.decks.length}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {decks.map((d, i) => {
          const active = d.id === selectedId
          return (
            <motion.button
              key={d.id}
              onClick={() => onSelect(d)}
              className="text-left group"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
            >
              <div className="relative rounded-xl p-1" style={{ background: active ? 'linear-gradient(135deg,#f6dc9a,#8a6a2b)' : 'transparent' }}>
                <Card faceDown deck={d} width={200} style={{ width: '100%', height: 'auto', aspectRatio: '5 / 7' }} />
                {active && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center text-ink shadow-lg">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <p className="text-[12.5px] font-bold mt-1.5 truncate">{d.name}</p>
              <p className="text-[11px] text-faint truncate">{d.description}</p>
            </motion.button>
          )
        })}
      </div>
    </Sheet>
  )
}

export function TablePicker({ open, selectedId, customTables = [], onSelect, onDeleteCustom, onClose }) {
  const fileRef = useRef(null)
  const [error, setError] = useState(null)
  const all = [...ALL_TABLES, ...customTables]

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const dataUrl = await fileToTableBackgroundDataUrl(file)
      onSelect(customTableTheme(dataUrl))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Tables" title="Choose your table" wide>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {all.map((t, i) => {
          const active = t.id === selectedId
          return (
            <motion.div key={t.id} className="relative" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <button onClick={() => onSelect(t)} className="block w-full text-left">
                <div
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden"
                  style={{
                    background: `${t.base ?? '#0b0a08'} url(${t.thumb ?? t.image}) center / cover no-repeat`,
                    boxShadow: active ? '0 0 0 2px #f1d28a, 0 10px 24px -10px rgb(212 166 74 / 0.7)' : '0 0 0 1px rgb(212 166 74 / 0.2)',
                  }}
                >
                  <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 70% at 50% 45%, transparent 40%, rgb(0 0 0 / 0.55))' }} />
                  {t.tag && <span className="absolute top-2 left-2 chip !text-[10px] !py-0.5 !bg-black/50">{t.tag}</span>}
                  {active && (
                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center text-ink">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </div>
                <p className="text-[13px] font-bold mt-1.5 truncate">{t.name}</p>
                <p className="text-[11px] text-faint truncate">{t.description}</p>
              </button>
              {t.custom && onDeleteCustom && (
                <button onClick={() => onDeleteCustom(t.id)} className="absolute bottom-12 right-2 btn btn-icon !w-8 !h-8" aria-label="Delete custom table">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          )
        })}
        {customTables.length < MAX_CUSTOM_TABLES && (
          <button
            onClick={() => fileRef.current?.click()}
            className="aspect-[4/3] rounded-2xl flex flex-col items-center justify-center gap-1.5 text-muted"
            style={{ border: '1px dashed rgb(212 166 74 / 0.4)', background: 'rgb(243 234 219 / 0.02)' }}
          >
            <ImagePlus className="w-6 h-6 text-gold" />
            <span className="text-[12px] font-semibold">Upload your own</span>
            <span className="text-[10.5px] text-faint">Image or GIF</span>
          </button>
        )}
      </div>
      {error && <p className="text-[12px] text-verm-hi mt-3">{error}</p>}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </Sheet>
  )
}
