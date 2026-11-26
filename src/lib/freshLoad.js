import { lazy } from 'react'

// Every update renames the game's code pieces, and the site only keeps the new
// ones. An app left open across an update (the Mac Dock app, a phone's
// home-screen app, yesterday's tab) still asks for the old names. Those
// requests 404, React has nothing to draw, and the screen goes black. These
// helpers swap in the new version instead.

const RELOADED_AT = 'amaterasuu-noir-spades:reloadedForUpdate'

// Reload once to fetch the new version. Returns false, without reloading, if
// we already reloaded a moment ago (so a real outage can't loop forever) or
// the device is offline (a reload would only show the browser's error page).
export function reloadForUpdate() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

// React.lazy that reloads into the new version when a piece is missing.
export function lazyLoad(load) {
  return lazy(() =>
    load().catch((err) => {
      // Keep showing the loading screen while the page reloads.
      if (reloadForUpdate()) return new Promise(() => {})
      throw err
    }),
  )
}

// Vite names the entry script after its contents, so a different name in the
// live index.html means the site has been updated since this page loaded.
const ENTRY = /\/assets\/index-[\w-]+\.js/

export async function newerVersionLive() {
  const mine = document.querySelector('script[type="module"][src*="/assets/index-"]')?.getAttribute('src')?.match(ENTRY)?.[0]
  if (!mine) return false // dev server: nothing to compare
  try {
    const res = await fetch('/', { cache: 'no-store' })
    if (!res.ok) return false
    const live = (await res.text()).match(ENTRY)?.[0]
    return Boolean(live) && live !== mine
  } catch {
    return false
  }
}
