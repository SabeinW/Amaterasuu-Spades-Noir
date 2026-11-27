// Deck and table pickers (used from the home screen and from the table menu).
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, ImagePlus, Star as StarIcon, Trash2 } from 'lucide-react'
import Sheet from './ui/Sheet'
import Card from './cards/Card'
import { ALL_TABLES, DECK_FAMILIES, MAX_CUSTOM_TABLES, customTableTheme, fileToTableBackgroundDataUrl } from '../data/tableThemes'
import { preloadDeckArt } from '../data/cardFamilies'
import { MIX, SKIN_TONES, setSkinTone, useSkinTone } from '../lib/skinTone'
import { useFavorites } from '../lib/favorites'

// The people on the court cards and Jokers, in the player's own skin tone.
const MIX_SWATCH = `conic-gradient(${SKIN_TONES.map((t, i) => `${t.swatch} ${(i / SKIN_TONES.length) * 360}deg ${((i + 1) / SKIN_TONES.length) * 360}deg`).join(', ')})`

function SkinTonePicker() {
  const tone = useSkinTone()
  const options = [...SKIN_TONES, { id: MIX, label: 'Mix', swatch: MIX_SWATCH }]
  const current = options.find((t) => t.id === tone)
  return (
    <div className="mb-4 flex flex-col items-center" role="radiogroup" aria-label="Skin tone of the people on the cards">
      <p className="eyebrow mb-2">
        Skin tone · <span className="text-paper normal-case tracking-normal">{current?.label}</span>
      </p>
      <div className="flex items-center gap-2.5">
        {options.map((t) => {
          const on = t.id === tone
          return (
            <button
              key={t.id}
              role="radio"
              aria-checked={on}
              aria-label={t.label}
              title={t.label}
              onClick={() => setSkinTone(t.id)}
              className="hover-pop relative w-9 h-9 rounded-full shrink-0 active:scale-90"
              style={{
                background: t.swatch,
                boxShadow: on ? '0 0 0 2px #12100c, 0 0 0 4px #f1d28a' : 'inset 0 0 0 1px rgb(255 255 255 / 0.18), 0 1px 3px rgb(0 0 0 / 0.5)',
              }}
            >
              {on && <Check className="absolute inset-0 m-auto w-4 h-4" style={{ color: t.id === 'pale' || t.id === 'olive' ? '#1b1307' : '#fff6e5' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const SAMPLE = [
  { suit: 'S', value: 'A', id: 'AS' },
  { suit: 'H', value: 'Q', id: 'QH' },
  { suit: 'S', value: 'K', id: 'KS' },
  { suit: 'D', value: '7', id: '7D' },
]

// Everything a deck preview shows: the Ace, every court, both Jokers, a few numbers.
const COURTS = ['S', 'H', 'D', 'C'].flatMap((suit) => ['K', 'Q', 'J'].map((value) => ({ suit, value, id: `${value}${suit}` })))
const PREVIEW = [
  { title: 'Ace & Jokers', cards: [{ suit: 'S', value: 'A', id: 'AS' }, { suit: 'JOKER', value: 'BIG', id: 'JOKER_BIG' }, { suit: 'JOKER', value: 'SMALL', id: 'JOKER_SMALL' }] },
  { title: 'Kings, Queens & Jacks', cards: COURTS },
  { title: 'Number cards', cards: [{ suit: 'C', value: '7', id: '7C' }, { suit: 'D', value: '10', id: '10D' }, { suit: 'H', value: '4', id: '4H' }, { suit: 'S', value: '9', id: '9S' }] },
]

function Star({ on, onClick, label, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-pressed={on}
      aria-label={label}
      title={on ? 'Remove from favorites' : 'Add to favorites'}
      className={`hover-pop w-8 h-8 rounded-full flex items-center justify-center active:scale-90 ${className}`}
      style={{ background: 'rgb(11 10 8 / 0.72)', border: `1px solid ${on ? '#f1d28a' : 'rgb(243 234 219 / 0.25)'}` }}
    >
      <StarIcon className="w-4 h-4" style={{ color: on ? '#f1d28a' : 'rgb(243 234 219 / 0.75)', fill: on ? '#f1d28a' : 'none' }} />
    </button>
  )
}

const chipOn = { background: 'linear-gradient(135deg,#f6dc9a,#d4a64a)', color: '#1b1307', borderColor: '#f1d28a' }

function DeckPreview({ deck, index, count, onPrev, onNext }) {
  const cols = 4
  const w = Math.floor(Math.min(112, (Math.min(window.innerWidth, 672) - 40 - (cols - 1) * 8) / cols))
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Card faceDown deck={deck} width={Math.round(w * 0.9)} />
        <div className="min-w-0 flex-1">
          {deck.tag && <span className="chip !text-[10px] !py-0.5">{deck.tag}</span>}
          <p className="text-[13px] text-muted mt-1.5 leading-snug">{deck.description}</p>
          {count > 1 && (
            <div className="flex items-center gap-2 mt-2">
              <button className="btn btn-icon !w-9 !h-9" onClick={onPrev} aria-label="Previous deck">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[12px] text-faint tabular-nums">
                {index + 1} of {count}
              </span>
              <button className="btn btn-icon !w-9 !h-9" onClick={onNext} aria-label="Next deck">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      {PREVIEW.map((group) => (
        <div key={group.title} className="mb-4">
          <p className="eyebrow mb-2">{group.title}</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, ${w}px)` }}>
            {group.cards.map((c) => (
              <Card key={c.id} card={c} deck={deck} width={w} lazy />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function DeckPicker({ open, selectedId, onSelect, onClose }) {
  const allDecks = DECK_FAMILIES.flatMap((f) => f.decks)
  const [favIds, toggleFav] = useFavorites('decks')
  const favDecks = favIds.map((id) => allDecks.find((d) => d.id === id)).filter(Boolean)
  const homeFamily = () => (favDecks.length ? 'favorites' : DECK_FAMILIES.find((f) => f.decks.some((d) => d.id === selectedId))?.id ?? 'standard')
  const [family, setFamily] = useState(homeFamily)
  const [preview, setPreview] = useState(null)
  const decks = family === 'favorites' ? favDecks : DECK_FAMILIES.find((f) => f.id === family)?.decks ?? []
  const current = allDecks.find((d) => d.id === selectedId)
  // One pick per opening: a slow phone mustn't turn a double tap into a second deck.
  const picked = useRef(false)
  const tone = useSkinTone()
  useEffect(() => {
    if (!open) return
    picked.current = false
    setPreview(null)
    setFamily(homeFamily())
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (d) => {
    if (picked.current) return
    picked.current = true
    preloadDeckArt(d, tone)
    onSelect(d)
  }
  // Previewing cycles through the tab you opened it from (your favorites, say).
  const list = preview && decks.some((d) => d.id === preview.id) ? decks : allDecks
  const at = preview ? list.findIndex((d) => d.id === preview.id) : -1
  const step = (n) => setPreview(list[(at + n + list.length) % list.length])
  const previewFav = preview && favIds.includes(preview.id)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={preview ? 'Deck preview' : 'Decks'}
      title={preview ? preview.name : 'Choose your deck'}
      wide
      footer={
        preview && (
          <div className="flex gap-2">
            <button className="btn btn-ghost !px-4" onClick={() => toggleFav(preview.id)} aria-pressed={previewFav}>
              <StarIcon className="w-4 h-4" style={{ color: '#f1d28a', fill: previewFav ? '#f1d28a' : 'none' }} />
              {previewFav ? 'Favorite' : 'Add to favorites'}
            </button>
            <button className="btn btn-gold flex-1" disabled={preview.id === selectedId} onClick={() => pick(preview)}>
              {preview.id === selectedId ? (
                <>
                  <Check className="w-4 h-4" /> In use
                </>
              ) : (
                'Use this deck'
              )}
            </button>
          </div>
        )
      }
    >
      {preview ? (
        <motion.div key={preview.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
          <button className="flex items-center gap-1 text-[13px] font-semibold text-gold mb-3" onClick={() => setPreview(null)}>
            <ChevronLeft className="w-4 h-4" /> All decks
          </button>
          <DeckPreview deck={preview} index={at} count={list.length} onPrev={() => step(-1)} onNext={() => step(1)} />
        </motion.div>
      ) : (
        <>
          {current && (
            <div className="flex items-end justify-center gap-1.5 mb-4 h-[124px]">
              <Card faceDown deck={current} width={70} style={{ transform: 'rotate(-10deg) translateY(8px)' }} />
              {SAMPLE.map((c, i) => (
                <Card key={c.id} card={c} deck={current} width={70} style={{ transform: `rotate(${(i - 1.5) * 5}deg) translateY(${Math.abs(i - 1.5) * 4}px)` }} />
              ))}
            </div>
          )}
          <SkinTonePicker />
          <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
            <button onClick={() => setFamily('favorites')} className="chip !text-[12px] !py-1.5 !px-3 shrink-0 flex items-center gap-1" style={family === 'favorites' ? chipOn : undefined}>
              <StarIcon className="w-3.5 h-3.5" style={{ fill: 'currentColor' }} /> Favorites · {favDecks.length}
            </button>
            {DECK_FAMILIES.map((f) => (
              <button key={f.id} onClick={() => setFamily(f.id)} className="chip !text-[12px] !py-1.5 !px-3 shrink-0" style={family === f.id ? chipOn : undefined}>
                {f.label} · {f.decks.length}
              </button>
            ))}
          </div>
          {family === 'favorites' && !favDecks.length && (
            <p className="text-[13px] text-muted text-center py-6 px-4">
              No favorites yet. Tap the <StarIcon className="w-3.5 h-3.5 inline text-gold-hi" /> on any deck to keep it here.
            </p>
          )}
          {decks.length > 0 && <p className="text-[11.5px] text-faint mb-2">Tap a deck to see all its cards.</p>}
          {/* The decks fade in together and never move, so a tap lands where it looks. */}
          <motion.div key={family} className="grid grid-cols-3 sm:grid-cols-5 gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
            {decks.map((d) => {
              const active = d.id === selectedId
              const fav = favIds.includes(d.id)
              return (
                <div key={d.id} className="relative">
                  <button onClick={() => setPreview(d)} className="deck-option text-left group w-full">
                    <div className="deck-art relative rounded-xl p-1" style={{ background: active ? 'linear-gradient(135deg,#f6dc9a,#8a6a2b)' : 'transparent' }}>
                      <Card faceDown deck={d} width={200} style={{ width: '100%', height: 'auto', aspectRatio: '5 / 7' }} />
                      {/* the deck's Queen of Hearts peeks out so each deck shows its own court */}
                      <div className="deck-peek absolute -right-1 -bottom-1">
                        <Card card={{ suit: 'H', value: 'Q', id: 'QH' }} deck={d} width={46} still thumb />
                      </div>
                      {active && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center text-ink shadow-lg">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <p className="deck-name text-[12.5px] font-bold mt-1.5 truncate">{d.name}</p>
                    <p className="text-[11px] text-faint truncate">{d.description}</p>
                  </button>
                  <Star on={fav} onClick={() => toggleFav(d.id)} label={`${fav ? 'Remove' : 'Add'} ${d.name} ${fav ? 'from' : 'to'} favorites`} className="absolute top-2 left-2" />
                </div>
              )
            })}
          </motion.div>
        </>
      )}
    </Sheet>
  )
}

export function TablePicker({ open, selectedId, customTables = [], onSelect, onDeleteCustom, onClose }) {
  const fileRef = useRef(null)
  const [error, setError] = useState(null)
  const [favIds, toggleFav] = useFavorites('tables')
  const all = [...ALL_TABLES, ...customTables]
  const favTables = favIds.map((id) => all.find((t) => t.id === id)).filter(Boolean)
  const [tab, setTab] = useState(() => (favTables.length ? 'favorites' : 'all'))
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!open) return
    setPreview(null)
    setTab(favTables.length ? 'favorites' : 'all')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const shown = tab === 'favorites' ? favTables : all
  const list = preview && shown.some((t) => t.id === preview.id) ? shown : all
  const at = preview ? list.findIndex((t) => t.id === preview.id) : -1
  const step = (n) => setPreview(list[(at + n + list.length) % list.length])
  const previewFav = preview && favIds.includes(preview.id)

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
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow={preview ? 'Table preview' : 'Tables'}
      title={preview ? preview.name : 'Choose your table'}
      wide
      footer={
        preview && (
          <div className="flex gap-2">
            <button className="btn btn-ghost !px-4" onClick={() => toggleFav(preview.id)} aria-pressed={previewFav}>
              <StarIcon className="w-4 h-4" style={{ color: '#f1d28a', fill: previewFav ? '#f1d28a' : 'none' }} />
              {previewFav ? 'Favorite' : 'Add to favorites'}
            </button>
            <button className="btn btn-gold flex-1" disabled={preview.id === selectedId} onClick={() => onSelect(preview)}>
              {preview.id === selectedId ? (
                <>
                  <Check className="w-4 h-4" /> In use
                </>
              ) : (
                'Use this table'
              )}
            </button>
          </div>
        )
      }
    >
      {preview ? (
        <motion.div key={preview.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
          <button className="flex items-center gap-1 text-[13px] font-semibold text-gold mb-3" onClick={() => setPreview(null)}>
            <ChevronLeft className="w-4 h-4" /> All tables
          </button>
          <div className="relative aspect-[3/4] sm:aspect-[4/3] rounded-2xl overflow-hidden" style={{ background: `${preview.base ?? '#0b0a08'} url(${preview.image}) center / cover no-repeat`, boxShadow: '0 0 0 1px rgb(212 166 74 / 0.3)' }}>
            <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 55% at 50% 46%, transparent 35%, rgb(0 0 0 / 0.55) 100%)' }} />
          </div>
          <p className="text-[13px] text-muted mt-3">{preview.description}</p>
          {list.length > 1 && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button className="btn btn-icon !w-9 !h-9" onClick={() => step(-1)} aria-label="Previous table">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[12px] text-faint tabular-nums">
                {at + 1} of {list.length}
              </span>
              <button className="btn btn-icon !w-9 !h-9" onClick={() => step(1)} aria-label="Next table">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </motion.div>
      ) : (
        <>
          <div className="flex gap-1.5 mb-3">
            <button onClick={() => setTab('favorites')} className="chip !text-[12px] !py-1.5 !px-3 flex items-center gap-1" style={tab === 'favorites' ? chipOn : undefined}>
              <StarIcon className="w-3.5 h-3.5" style={{ fill: 'currentColor' }} /> Favorites · {favTables.length}
            </button>
            <button onClick={() => setTab('all')} className="chip !text-[12px] !py-1.5 !px-3" style={tab === 'all' ? chipOn : undefined}>
              All tables · {all.length}
            </button>
          </div>
          {tab === 'favorites' && !favTables.length && (
            <p className="text-[13px] text-muted text-center py-6 px-4">
              No favorites yet. Tap the <StarIcon className="w-3.5 h-3.5 inline text-gold-hi" /> on any table to keep it here.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {shown.map((t, i) => {
              const active = t.id === selectedId
              const fav = favIds.includes(t.id)
              return (
                <motion.div key={t.id} className="relative" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <button onClick={() => setPreview(t)} className="table-option block w-full text-left">
                    <div
                      className="table-art relative aspect-[4/3] rounded-2xl overflow-hidden"
                      style={{
                        background: `${t.base ?? '#0b0a08'} url(${t.thumb ?? t.image}) center / cover no-repeat`,
                        boxShadow: active ? '0 0 0 2px #f1d28a, 0 10px 24px -10px rgb(212 166 74 / 0.7)' : '0 0 0 1px rgb(212 166 74 / 0.2)',
                      }}
                    >
                      <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 70% at 50% 45%, transparent 40%, rgb(0 0 0 / 0.55))' }} />
                      {t.tag && <span className="absolute bottom-2 left-2 chip !text-[10px] !py-0.5 !bg-black/50">{t.tag}</span>}
                      {active && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gold flex items-center justify-center text-ink">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <p className="table-name text-[13px] font-bold mt-1.5 truncate transition-colors">{t.name}</p>
                    <p className="text-[11px] text-faint truncate">{t.description}</p>
                  </button>
                  <Star on={fav} onClick={() => toggleFav(t.id)} label={`${fav ? 'Remove' : 'Add'} ${t.name} ${fav ? 'from' : 'to'} favorites`} className="absolute top-2 left-2" />
                  {t.custom && onDeleteCustom && (
                    <span className="absolute bottom-12 right-2">
                      <button onClick={() => onDeleteCustom(t.id)} className="btn btn-icon !w-8 !h-8" aria-label="Delete custom table">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                </motion.div>
              )
            })}
            {tab === 'all' && customTables.length < MAX_CUSTOM_TABLES && (
              <button
                onClick={() => fileRef.current?.click()}
                className="hover-tile aspect-[4/3] rounded-2xl flex flex-col items-center justify-center gap-1.5 text-muted"
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
        </>
      )}
    </Sheet>
  )
}
