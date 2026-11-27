// Phone health check. Off unless turned on (tap "amaterasuu.com" on the home
// screen 5 times, or open /?debug=1; /?debug=0 turns it off). While on, it
// records frame timing, errors and whether the table is keeping up with the
// game, for the PhoneCheck panel (components/ui/PhoneCheck.jsx). Imported
// first in main.jsx so it catches errors from the very start.
const KEY = 'amaterasuu-noir-spades:debug'

function readFlag() {
  try {
    const q = new URLSearchParams(window.location.search).get('debug')
    if (q === '1') localStorage.setItem(KEY, '1')
    if (q === '0') localStorage.removeItem(KEY)
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const diagOn = typeof window !== 'undefined' && readFlag()

export function toggleDiag() {
  try {
    if (localStorage.getItem(KEY) === '1') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: nothing to toggle
  }
  window.location.reload()
}

export const diag = { frames: [], lastFrameAt: 0, longestGapMs: 0, errors: [], sync: null, hiddenAt: null }

if (diagOn) {
  const note = (msg) => {
    diag.errors.push({ at: new Date().toLocaleTimeString(), msg: String(msg).slice(0, 140) })
    if (diag.errors.length > 20) diag.errors.shift()
  }
  window.addEventListener('error', (e) => note(e.message || e.error))
  window.addEventListener('unhandledrejection', (e) => note(`promise: ${e.reason?.message ?? e.reason}`))
  const origError = console.error
  console.error = (...args) => {
    note(args.map((a) => a?.message ?? a).join(' '))
    origError.apply(console, args)
  }
  document.addEventListener('visibilitychange', () => {
    diag.hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null
  })
  const tick = (t) => {
    const now = performance.now()
    if (diag.lastFrameAt && document.visibilityState === 'visible') diag.longestGapMs = Math.max(diag.longestGapMs, now - diag.lastFrameAt)
    diag.lastFrameAt = now
    diag.frames.push(t)
    if (diag.frames.length > 120) diag.frames.shift()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// The table's event player reports how far behind the real game it is.
export function reportSync(viewSeq, latestSeq, queued) {
  if (!diagOn) return
  const behind = (latestSeq ?? 0) - (viewSeq ?? 0)
  const prev = diag.sync
  diag.sync = { viewSeq, latestSeq, queued, behind, since: behind > 0 ? (prev?.behind > 0 ? prev.since : Date.now()) : null }
}
