// Pick an emoji or a trash-talk line to throw at the table. `grid` is the tray
// that pops up over your seat, with a GIF button and your recent picks in a
// strip on top; `row` is the strip under the chat. Hands and people come in the
// player's own skin tone.
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Clock, Search } from 'lucide-react'
import { EMOJI_GROUPS, LINES, readEmote, recentPicks, withTone } from '../../data/taunts'
import { useSkinTone } from '../../lib/skinTone'

// Short enough to fit on a small iPhone without scrolling.
const TABS = [
  { id: 'talk', label: 'Trash talk' },
  { id: 'lines', label: 'Lines' },
  { id: 'team', label: 'Team' },
  { id: 'hype', label: 'Hype' },
  { id: 'react', label: 'React' },
]

function picksFor(tab) {
  // Lines = trash talk; Team = partner talk, hype and good-game lines.
  if (tab === 'lines' || tab === 'team') return LINES.filter((l) => (l.mood === 'talk') === (tab === 'lines')).map((l) => ({ kind: 'l', id: l.id }))
  return EMOJI_GROUPS.find((g) => g.id === tab).items.map((id) => ({ kind: 'e', id }))
}

function PickButton({ pick, tone, onPick, again = false }) {
  const shown = readEmote({ ...pick, tone })
  if (!shown) return null
  if (shown.kind === 'g') {
    return (
      <button
        onClick={() => onPick(pick)}
        aria-label={again ? 'Again: GIF' : 'Send GIF'}
        className="w-10 h-10 shrink-0 rounded-xl overflow-hidden active:scale-90 transition-transform"
        style={{ border: '1px solid rgb(212 166 74 / 0.2)', background: '#0b0a08' }}
      >
        <img src={shown.url} alt="" loading="lazy" decoding="async" className={`w-full h-full ${shown.sticker ? 'object-contain' : 'object-cover'}`} />
      </button>
    )
  }
  if (shown.kind === 'l') {
    return (
      <button
        onClick={() => onPick(pick)}
        aria-label={again ? `Again: ${shown.text}` : undefined}
        className="shrink-0 h-10 rounded-xl px-3 text-[13px] font-semibold whitespace-nowrap hover:bg-white/5 active:scale-95 transition-transform"
        style={{ border: '1px solid rgb(212 166 74 / 0.22)', background: 'rgb(243 234 219 / 0.04)' }}
      >
        {shown.text} <span className="text-[15px]">{shown.emoji}</span>
      </button>
    )
  }
  return (
    <button
      onClick={() => onPick(pick)}
      aria-label={again ? `Again: ${pick.id}` : `Send ${pick.id}`}
      className="w-10 h-10 shrink-0 rounded-xl text-[22px] leading-none flex items-center justify-center hover:bg-white/5 active:scale-90 transition-transform"
      style={{ border: '1px solid rgb(212 166 74 / 0.2)' }}
    >
      {withTone(pick.id, tone)}
    </button>
  )
}

export function EmotePicker({ onPick, onGif, variant = 'grid' }) {
  const tone = useSkinTone()
  const [recent] = useState(recentPicks)
  const [tab, setTab] = useState(TABS[0].id)
  const row = variant === 'row'

  return (
    <div>
      {!row && (onGif || recent.length > 0) && (
        <div className="flex items-center gap-1.5 mb-2 overflow-x-auto no-scrollbar" aria-label="Recent picks">
          {onGif && (
            <button
              onClick={onGif}
              className="shrink-0 h-10 rounded-xl px-3 flex items-center gap-1.5 text-[13px] font-extrabold tracking-wide active:scale-95 transition-transform"
              style={{ background: 'linear-gradient(135deg,#f6dc9a,#d4a64a)', color: '#1b1307' }}
            >
              <Search className="w-3.5 h-3.5" /> GIFs
            </button>
          )}
          {recent.length > 0 && <Clock className="w-4 h-4 shrink-0 text-faint ml-0.5" aria-hidden />}
          {recent.map((p) => (
            <PickButton key={`${p.kind}:${p.id}`} pick={p} tone={tone} onPick={onPick} again />
          ))}
        </div>
      )}
      <div className="flex gap-1 mb-2 overflow-x-auto no-scrollbar" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="shrink-0 rounded-full px-2 h-8 text-[12px] font-bold whitespace-nowrap transition-colors"
            style={
              tab === t.id
                ? { background: 'rgb(212 166 74 / 0.22)', color: '#f6dc9a', border: '1px solid rgb(241 210 138 / 0.55)' }
                : { color: 'rgb(243 234 219 / 0.65)', border: '1px solid rgb(212 166 74 / 0.18)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className={row ? 'flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5' : 'flex flex-wrap gap-1.5 max-h-[232px] overflow-y-auto no-scrollbar content-start'}>
        {picksFor(tab).map((p) => (
          <PickButton key={`${p.kind}:${p.id}`} pick={p} tone={tone} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}

// The tray over your seat. A tap anywhere else closes it (and doesn't reach
// the cards underneath).
export function EmoteTray({ open, onClose, onPick, onGif }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="tray-backdrop"
            aria-label="Close trash talk"
            className="fixed inset-0 z-[55] cursor-default"
            style={{ background: 'rgb(0 0 0 / 0.25)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={onClose}
          />
          <span key="tray" className="absolute z-[60] bottom-full mb-2 left-1/2 w-[min(372px,calc(100vw-16px))]" style={{ transform: 'translateX(-50%)' }}>
            <motion.div
              className="rounded-2xl p-2.5"
              style={{ background: '#15110c', border: '1px solid rgb(241 210 138 / 0.35)', boxShadow: '0 18px 50px -12px rgb(0 0 0 / 0.85)', transformOrigin: '50% 100%' }}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <EmotePicker onPick={onPick} onGif={onGif} />
            </motion.div>
          </span>
        </>
      )}
    </AnimatePresence>
  )
}
