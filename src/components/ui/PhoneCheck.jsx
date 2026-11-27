// The phone health check panel (see lib/diag.js). Its clock ticks from a
// timer, not from screen redraws, so if the screen stops redrawing, the
// clock here falls behind the phone's own clock in a screenshot.
import { useEffect, useState } from 'react'
import { diag, diagOn, toggleDiag } from '../../lib/diag'

const build = () => document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src')?.match(/index-([\w-]+)\.js/)?.[1]?.slice(0, 8) ?? 'dev'

function pictures() {
  let ok = 0
  let waiting = 0
  let failed = 0
  for (const img of document.images) {
    if (!img.getAttribute('src')?.includes('/art/')) continue
    if (!img.complete) waiting++
    else if (img.naturalWidth > 0) ok++
    else failed++
  }
  return { ok, waiting, failed }
}

export default function PhoneCheck() {
  const [, setTick] = useState(0)
  const [open, setOpen] = useState(true)
  useEffect(() => {
    if (!diagOn) return
    const t = setInterval(() => setTick((n) => n + 1), 500)
    return () => clearInterval(t)
  }, [])
  if (!diagOn) return null

  const now = performance.now()
  const f = diag.frames
  const fps = f.length > 10 ? Math.round(((f.length - 1) * 1000) / (f.at(-1) - f[0])) : 0
  const frameAge = Math.round(now - diag.lastFrameAt)
  const stopped = frameAge > 1000
  const s = diag.sync
  const pics = pictures()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const row = (label, value, bad) => (
    <div className="flex justify-between gap-3">
      <span className="opacity-60">{label}</span>
      <span style={{ color: bad ? '#ff8a72' : '#9ff0b0' }}>{value}</span>
    </div>
  )

  return (
    <div
      className="fixed z-[200] left-2 rounded-xl px-2.5 py-2 font-mono text-[10.5px] leading-[1.45] text-white"
      style={{ top: 'calc(0.5rem + var(--safe-t))', background: 'rgb(0 0 0 / 0.82)', border: '1px solid rgb(255 255 255 / 0.25)', width: open ? 214 : 'auto' }}
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex justify-between gap-3 font-bold">
        <span>Phone check</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>
      {open && (
        <>
          {row('screen', stopped ? `STOPPED ${(frameAge / 1000).toFixed(1)}s` : `${fps} fps`, stopped || fps < 25)}
          {row('longest freeze', `${(diag.longestGapMs / 1000).toFixed(1)}s`, diag.longestGapMs > 2000)}
          {row('table', !s ? 'not in a game' : s.behind > 0 ? `behind ${s.behind} (${((Date.now() - s.since) / 1000).toFixed(0)}s)` : 'in sync', s?.behind > 0 && Date.now() - s.since > 5000)}
          {row('pictures', `${pics.ok} ok · ${pics.waiting} wait · ${pics.failed} fail`, pics.failed > 0 || pics.waiting > 0)}
          {row('errors', diag.errors.length, diag.errors.length > 0)}
          {diag.errors.slice(-2).map((e, i) => (
            <div key={i} className="opacity-80 break-words" style={{ color: '#ffb4a6' }}>
              {e.at} {e.msg}
            </div>
          ))}
          {row('reduce motion', reduce ? 'on' : 'off')}
          {row('build', build())}
          <button
            className="mt-1 w-full rounded-md py-1 text-[10px] font-bold"
            style={{ background: 'rgb(255 255 255 / 0.12)' }}
            onClick={(e) => {
              e.stopPropagation()
              toggleDiag()
            }}
          >
            Turn off phone check
          </button>
        </>
      )}
    </div>
  )
}
