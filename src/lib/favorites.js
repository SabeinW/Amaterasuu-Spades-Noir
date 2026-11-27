// Favorite decks and tables, kept on this device. Every picker that shows a
// star stays in step through a window event.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'amaterasuu-noir-spades:favorites'
const EVENT = 'amaterasuu-favorites'

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { decks: Array.isArray(v.decks) ? v.decks : [], tables: Array.isArray(v.tables) ? v.tables : [] }
  } catch {
    return { decks: [], tables: [] }
  }
}

// kind: 'decks' | 'tables'. Returns [ids in the order they were starred, toggle(id)].
export function useFavorites(kind) {
  const [ids, setIds] = useState(() => read()[kind])
  useEffect(() => {
    const on = () => setIds(read()[kind])
    window.addEventListener(EVENT, on)
    return () => window.removeEventListener(EVENT, on)
  }, [kind])
  const toggle = useCallback(
    (id) => {
      const all = read()
      all[kind] = all[kind].includes(id) ? all[kind].filter((x) => x !== id) : [...all[kind], id]
      try {
        localStorage.setItem(KEY, JSON.stringify(all))
      } catch {
        // storage unavailable: the star still changes for now
      }
      setIds(all[kind])
      window.dispatchEvent(new Event(EVENT))
    },
    [kind]
  )
  return [ids, toggle]
}
