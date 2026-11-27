// GIFs, GIPHY stickers and your own stickers to throw at the table.
// GIFs/Stickers: one-tap searches up top so most picks never need the
// keyboard; typed searches run when you press search (not on every letter),
// since the GIPHY key allows 100 an hour. Mine: your own pictures, added from
// Photos or pasted in, saved to your account.
import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Search, X } from 'lucide-react'
import Sheet from '../ui/Sheet'
import { QUICK, giphyClicked, giphySeen, giphySent, searchGiphy } from '../../lib/giphy'
import { MAX_STICKERS, addSticker, imageFromTransfer, listMyStickers, picturesFrom, prepareFirst, prepareSticker, removeSticker } from '../../lib/stickers'
import { forgetPick } from '../../data/taunts'

const TABS = [
  { id: 'gifs', label: 'GIFs', title: 'GIFs' },
  { id: 'stickers', label: 'Stickers', title: 'Stickers' },
  { id: 'mine', label: 'Mine', title: 'Your stickers' },
]

const pill = (on) =>
  on
    ? { background: 'rgb(212 166 74 / 0.22)', color: '#f6dc9a', border: '1px solid rgb(241 210 138 / 0.55)' }
    : { color: 'rgb(243 234 219 / 0.75)', border: '1px solid rgb(212 166 74 / 0.2)' }

export function GifSheet({ open, onClose, onPick, userId }) {
  const [tab, setTab] = useState('gifs')
  const giphy = tab !== 'mine'
  return (
    <Sheet
      open={open}
      onClose={onClose}
      eyebrow="Trash talk"
      title={TABS.find((t) => t.id === tab).title}
      z={75}
      footer={
        giphy ? (
          // GIPHY's official attribution mark (from their attribution pack, dark-background version)
          <img src="/giphy/powered-by-giphy.png" alt="Powered by GIPHY" width="151" height="20" className="block mx-auto h-5 w-auto" />
        ) : null
      }
    >
      <div className="grid grid-cols-3 rounded-xl overflow-hidden mb-3" style={{ border: '1px solid rgb(212 166 74 / 0.3)' }} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="h-9 text-[13px] font-bold"
            style={tab === t.id ? { background: 'rgb(212 166 74 / 0.22)', color: '#f6dc9a' } : { color: 'rgb(243 234 219 / 0.6)' }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {giphy ? <GiphyPanel kind={tab} open={open} onPick={onPick} /> : <MyStickers userId={userId} onPick={onPick} />}
    </Sheet>
  )
}

function GiphyPanel({ kind, open, onPick }) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState({ gifs: QUICK.gifs[0], stickers: QUICK.stickers[0] })
  const [state, setState] = useState({ items: [], loading: false, error: null })
  const inputRef = useRef(null)
  const q = query[kind]

  useEffect(() => {
    if (!open || !q) return
    const ac = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    searchGiphy(kind, q, { signal: ac.signal })
      .then((items) => setState({ items, loading: false, error: null }))
      .catch((e) => e.name !== 'AbortError' && setState({ items: [], loading: false, error: e.message }))
    return () => ac.abort()
  }, [open, kind, q])

  const run = (next) => {
    setText(next)
    setQuery((all) => ({ ...all, [kind]: next }))
  }
  function submit(e) {
    e.preventDefault()
    if (text.trim()) run(text.trim())
    inputRef.current?.blur() // drops the iPhone keyboard so the results show
  }

  return (
    <>
      <form onSubmit={submit} className="relative">
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
      </form>
      <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
        {QUICK[kind].map((chip) => (
          <button key={chip} type="button" onClick={() => run(chip)} className="shrink-0 rounded-full px-3 h-8 text-[12.5px] font-semibold whitespace-nowrap" style={pill(q === chip)}>
            {chip}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-[240px]">
        {state.error ? (
          <p className="text-center text-[13px] text-verm-hi mt-10">{state.error}</p>
        ) : state.loading && !state.items.length ? (
          <p className="text-center text-[13px] text-faint mt-10">Finding {kind === 'gifs' ? 'GIFs' : 'stickers'}…</p>
        ) : !state.items.length ? (
          <p className="text-center text-[13px] text-faint mt-10">Nothing for “{q}”. Try another search.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5" style={{ opacity: state.loading ? 0.5 : 1 }}>
            {state.items.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  giphyClicked(g)
                  if (onPick({ kind: 'g', id: g.id, url: g.url, w: g.w, h: g.h, sticker: g.sticker })) giphySent(g)
                }}
                aria-label={`Send ${g.title}`}
                className="h-[112px] rounded-xl overflow-hidden flex items-center justify-center active:scale-95 transition-transform"
                style={{ background: g.sticker ? 'rgb(243 234 219 / 0.06)' : '#0b0a08', border: '1px solid rgb(212 166 74 / 0.16)' }}
              >
                <img src={g.thumb} alt={g.title} loading="lazy" decoding="async" onLoad={() => giphySeen(g)} className={`w-full h-full ${g.sticker ? 'object-contain p-1.5' : 'object-cover'}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function MyStickers({ userId, onPick }) {
  const [items, setItems] = useState(null) // null while loading
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const fileRef = useRef(null)
  const pasteRef = useRef(null)
  const readingRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    listMyStickers(userId)
      .then(setItems)
      .catch((e) => {
        setItems([])
        setMsg({ ok: false, text: e.message })
      })
  }, [userId])

  if (!userId) return <p className="text-center text-[13px] text-faint mt-8">Sign in to save your own stickers.</p>

  const count = items?.length ?? 0
  async function add(blobs) {
    const room = MAX_STICKERS - count
    if (!blobs.length) return
    if (room <= 0) return setMsg({ ok: false, text: `You have ${MAX_STICKERS} stickers. Remove one to add another.` })
    setBusy(true)
    setMsg(null)
    let added = 0
    try {
      // Each one is a picture, or a list of copies of one picture (a sticker
      // pasted from Safari comes as Apple's format plus a PNG).
      for (const one of blobs.slice(0, room)) {
        const saved = await addSticker(userId, Array.isArray(one) ? await prepareFirst(one) : await prepareSticker(one))
        setItems((list) => [saved, ...(list ?? [])])
        added++
      }
      setMsg({ ok: true, text: added === 1 ? 'Saved. Tap it to throw it.' : `${added} stickers saved.` })
      if (blobs.length > room) setMsg({ ok: false, text: `Saved ${added}. That's the ${MAX_STICKERS}-sticker limit.` })
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'That sticker didn’t save. Try again.' })
    } finally {
      setBusy(false)
    }
  }

  // The paste box: a pasted or dropped picture, or one the keyboard drops in.
  // A plain picture comes as a file. An Apple sticker or Genmoji doesn't: Safari
  // treats it like an emoji and puts it in the box as a <picture>, so when
  // there's no file the paste or drop goes ahead and onInput reads what landed.
  function onPaste(e) {
    const file = imageFromTransfer(e.clipboardData)
    if (file) {
      e.preventDefault()
      add([file])
    }
  }
  function onDrop(e) {
    const file = imageFromTransfer(e.dataTransfer)
    if (file) {
      e.preventDefault()
      add([file])
    }
  }
  async function onInput() {
    const box = pasteRef.current
    if (!box || readingRef.current) return
    if (!box.querySelector('img, picture, source') && !box.textContent) return
    readingRef.current = true
    // A moment for the browser to finish putting it in.
    await new Promise((r) => setTimeout(r, 60))
    const hasPicture = !!box.querySelector('img, picture, source')
    const blobs = hasPicture ? await picturesFrom(box) : []
    box.innerHTML = ''
    readingRef.current = false
    if (blobs.length) add([blobs])
    else if (hasPicture) setMsg({ ok: false, text: 'That sticker couldn’t be read here. Try saving it to Photos, then Add from Photos.' })
    else setMsg({ ok: false, text: 'That came in as text, not a picture. Copy the sticker itself, then paste it here.' })
  }
  async function remove(s) {
    try {
      await removeSticker(s.path)
      forgetPick(s.url)
      setItems((list) => list.filter((x) => x.path !== s.path))
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-gold !min-h-12 !text-[13.5px]" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus className="w-4 h-4" /> Add from Photos
        </button>
        <div
          ref={pasteRef}
          contentEditable={!busy}
          suppressContentEditableWarning
          role="textbox"
          aria-label="Paste a sticker"
          data-placeholder="Paste a sticker"
          onPaste={onPaste}
          onDrop={onDrop}
          onInput={onInput}
          className="min-h-12 rounded-2xl px-3 flex items-center justify-center text-[13px] font-semibold text-center outline-none overflow-hidden empty:before:content-[attr(data-placeholder)] empty:before:text-faint focus:border-solid"
          style={{ border: '1.5px dashed rgb(241 210 138 / 0.45)', background: 'rgb(243 234 219 / 0.04)' }}
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          add([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />
      <p className="text-[11.5px] text-faint mt-2 leading-snug">
        On iPhone: press and hold a sticker in Messages (or lift a subject in Photos), tap Copy, then tap the paste box and Paste. Stickers from the emoji keyboard work too. On a Mac: copy it, click the box, press ⌘V.
      </p>
      {(msg || busy) && (
        <p className="text-[12px] mt-1.5" style={{ color: busy ? '#f6dc9a' : msg.ok ? '#9ff0b0' : '#ffb4a6' }}>
          {busy ? 'Saving…' : msg.text}
        </p>
      )}

      <div className="flex items-baseline justify-between mt-3 mb-1.5">
        <p className="eyebrow">
          Your stickers · {count} of {MAX_STICKERS}
        </p>
        {count > 0 && (
          <button type="button" className="text-[12.5px] font-bold text-gold-hi" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
      </div>
      {items === null ? (
        <p className="text-center text-[13px] text-faint mt-6">Loading your stickers…</p>
      ) : count === 0 ? (
        <p className="text-center text-[13px] text-faint mt-6">No stickers yet. Add one from Photos or paste one in.</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {items.map((s) => (
            <div key={s.path} className="relative">
              <button
                type="button"
                onClick={() => !editing && onPick({ kind: 'g', id: s.id, url: s.url, w: s.w, h: s.h, sticker: true })}
                aria-label="Send your sticker"
                className="w-full aspect-square rounded-xl flex items-center justify-center active:scale-95 transition-transform"
                style={{ background: 'rgb(243 234 219 / 0.06)', border: '1px solid rgb(212 166 74 / 0.16)', opacity: editing ? 0.7 : 1 }}
              >
                <img src={s.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain p-1" />
              </button>
              {editing && (
                // .btn-style buttons set their own position; this one is a plain button
                <button
                  type="button"
                  onClick={() => remove(s)}
                  aria-label="Delete this sticker"
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: '#e0442e', color: '#fff', boxShadow: '0 2px 6px rgb(0 0 0 / 0.5)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
