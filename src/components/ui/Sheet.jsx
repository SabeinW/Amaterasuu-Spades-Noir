import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect } from 'react'

// Bottom sheet on phones, centred dialog on wider screens. Escape / backdrop closes.
export default function Sheet({ open, onClose, title, eyebrow, children, footer, wide = false, dismissable = true, z = 60 }) {
  useEffect(() => {
    if (!open || !dismissable) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismissable, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 flex items-end sm:items-center justify-center"
          style={{ zIndex: z }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[3px]" onClick={dismissable ? onClose : undefined} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`panel relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[88dvh] flex flex-col rounded-t-[28px] sm:rounded-[24px] overflow-hidden`}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15" />
            {(title || dismissable) && (
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                <div className="min-w-0">
                  {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
                  {title && <h2 className="text-xl font-bold text-paper leading-tight">{title}</h2>}
                </div>
                {dismissable && (
                  <button onClick={onClose} className="btn btn-icon -mr-1 shrink-0" aria-label="Close">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            <div className="gold-rule mx-5" />
            <div className="px-5 py-4 overflow-y-auto min-h-0 flex-1">{children}</div>
            {footer && <div className="px-5 pt-3 pb-[calc(1rem+var(--safe-b))] border-t border-white/5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
