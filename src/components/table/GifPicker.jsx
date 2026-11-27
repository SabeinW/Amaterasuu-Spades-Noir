// Search GIPHY for a GIF or sticker to throw at the table. One-tap searches
// up top so most picks never need the keyboard; typed searches run when you
// press search (not on every letter), since the key allows 100 an hour.
import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import Sheet from '../ui/Sheet'
import { QUICK, searchGiphy } from '../../lib/giphy'

export function GifSheet({ open, onClose, onPick }) {
  const [kind, setKind] = useState('gifs')
  const [text, setText] = useState('')
  const [query, setQuery] = useState(QUICK.gifs[0])
  const [state, setState] = useState({ items: [], loading: false, error: null })
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open || !query) return
    const ac = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    searchGiphy(kind, query, { signal: ac.signal })
      .then((items) => setState({ items, loading: false, error: null }))
      .catch((e) => e.name !== 'AbortError' && setState({ items: [], loading: false, error: e.message }))
    return () => ac.abort()
  }, [open, kind, query])

  function run(q) {
    setText(q)
    setQuery(q)
  }
  function submit(e) {
    e.preventDefault()
    const q = text.trim()
    if (q) setQuery(q)
    inputRef.current?.blur() // drops the iPhone keyboard so the results show
  }
  function switchKind(k) {
    if (k === kind) return
    setKind(k)
    if (!text.trim()) setQuery(QUICK[k][0])
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Trash talk"
      title={kind === 'gifs' ? 'GIFs' : 'Stickers'}
      z={75}
      footer={
        <p className="text-center text-[11px] font-bold tracking-[0.16em] uppercase text-faint">
          Powered by <span className="text-paper">GIPHY</span>
        </p>
      }
    >
      <form onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-faint absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search GIPHY"
            enterKeyHint="search"
            maxLength={50}
            className="field !pl-9"
            aria-label="Search GIPHY"
          />
        </div>
        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: '1px solid rgb(212 166 74 / 0.3)' }} role="tablist">
          {['gifs', 'stickers'].map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => switchKind(k)}
              className="px-3 text-[12.5px] font-bold"
              style={kind === k ? { background: 'rgb(212 166 74 / 0.22)', color: '#f6dc9a' } : { color: 'rgb(243 234 219 / 0.6)' }}
            >
              {k === 'gifs' ? 'GIFs' : 'Stickers'}
            </button>
          ))}
        </div>
      </form>

      <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
        {QUICK[kind].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => run(q)}
            className="shrink-0 rounded-full px-3 h-8 text-[12.5px] font-semibold whitespace-nowrap"
            style={
              query === q
                ? { background: 'rgb(212 166 74 / 0.22)', color: '#f6dc9a', border: '1px solid rgb(241 210 138 / 0.55)' }
                : { color: 'rgb(243 234 219 / 0.75)', border: '1px solid rgb(212 166 74 / 0.2)' }
            }
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-[240px]">
        {state.error ? (
          <p className="text-center text-[13px] text-verm-hi mt-10">{state.error}</p>
        ) : state.loading && !state.items.length ? (
          <p className="text-center text-[13px] text-faint mt-10">Finding {kind === 'gifs' ? 'GIFs' : 'stickers'}…</p>
        ) : !state.items.length ? (
          <p className="text-center text-[13px] text-faint mt-10">Nothing for “{query}”. Try another search.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" style={{ opacity: state.loading ? 0.5 : 1 }}>
            {state.items.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onPick({ kind: 'g', id: g.id, url: g.url, w: g.w, h: g.h, sticker: g.sticker })}
                aria-label={`Send ${g.title}`}
                className="h-[112px] rounded-xl overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
                style={{ background: g.sticker ? 'rgb(243 234 219 / 0.06)' : '#0b0a08', border: '1px solid rgb(212 166 74 / 0.16)' }}
              >
                <img src={g.thumb} alt={g.title} loading="lazy" decoding="async" className={`w-full h-full ${g.sticker ? 'object-contain p-1.5' : 'object-cover'}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
