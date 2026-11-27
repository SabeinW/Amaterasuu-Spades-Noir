// The practice coach's speech bubble, docked just above your seat. Says what's
// going on and, on your turn, which card to play and why (lib/coach.js).
// Only fades and slides: nothing here repaints every frame on a phone.
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { GraduationCap, ChevronDown, ChevronUp } from 'lucide-react'

// onHeight tells the table how tall the bubble is, so notices can sit above it.
export default function CoachBubble({ lines, title, minimized, onToggle, onHeight }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !onHeight) return
    const ro = new ResizeObserver(() => onHeight(el.offsetHeight))
    ro.observe(el)
    return () => {
      ro.disconnect()
      onHeight(0)
    }
  }, [onHeight])
  if (!lines?.length) return null
  return (
    <div ref={ref} className="absolute left-0 right-0 bottom-full mb-1 flex justify-center px-2 pointer-events-none">
      <motion.div
        className="pointer-events-auto rounded-2xl w-[min(94vw,460px)] text-[12.5px] leading-snug"
        style={{ background: 'rgb(16 13 9 / 0.94)', border: '1px solid rgb(241 210 138 / 0.4)', boxShadow: '0 8px 24px rgb(0 0 0 / 0.45)' }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <button type="button" className="w-full flex items-center gap-1.5 px-3 pt-2 pb-1 text-left font-bold text-gold-hi" onClick={onToggle} aria-expanded={!minimized}>
          <GraduationCap className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{title}</span>
          {minimized ? <ChevronUp className="w-4 h-4 opacity-70" /> : <ChevronDown className="w-4 h-4 opacity-70" />}
        </button>
        <AnimatePresence initial={false}>
          {!minimized && (
            <motion.div key={lines.join('|')} className="px-3 pb-2.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {lines.map((l, i) => (
                <p key={i} className={i === lines.length - 1 && lines.length > 1 ? 'text-paper font-semibold mt-1' : 'text-paper/80'}>
                  {l}
                </p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
