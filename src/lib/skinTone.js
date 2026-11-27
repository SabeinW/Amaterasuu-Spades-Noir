// The skin tone of the people on the illustrated cards (court cards and
// Jokers). Each player picks their own; it's saved on this device and only
// changes what they see, so a table can mix choices.
//
// Brown is the art as first painted and stays the default. Every other tone
// is a copy of each card in /art/court/<set>/<tone>/ (see scripts/art/skin-tones.ts).
// Every new court set needs all of them.
import { useSyncExternalStore } from 'react'

export const SKIN_TONES = [
  { id: 'pale', label: 'Pale', swatch: '#efcdb8' },
  { id: 'olive', label: 'Olive', swatch: '#d5ab82' },
  { id: 'light', label: 'Light brown', swatch: '#b57b52' },
  { id: 'brown', label: 'Brown', swatch: '#7b4a2c' },
  { id: 'deep', label: 'Deep', swatch: '#40241a' },
]
export const DEFAULT_TONE = 'brown'
// Mix gives every card its own tone, so the court looks like a mixed room.
export const MIX = 'mix'

const KEY = 'amaterasuu-noir-spades:skinTone'
const VALID = new Set([...SKIN_TONES.map((t) => t.id), MIX])

function read() {
  try {
    const v = localStorage.getItem(KEY)
    return VALID.has(v) ? v : DEFAULT_TONE
  } catch {
    return DEFAULT_TONE
  }
}

let current = typeof window === 'undefined' ? DEFAULT_TONE : read()
const listeners = new Set()

export function setSkinTone(tone) {
  if (!VALID.has(tone) || tone === current) return
  current = tone
  try {
    localStorage.setItem(KEY, tone)
  } catch {
    // storage unavailable: the choice still applies until the page closes
  }
  for (const l of listeners) l()
}

const subscribe = (l) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const useSkinTone = () => useSyncExternalStore(subscribe, () => current, () => DEFAULT_TONE)

// The tone one card is drawn in. Mix picks from the card and its court, so a
// card keeps the same person every time it's dealt.
export function toneFor(tone, courtSet, cardId) {
  if (tone !== MIX) return tone
  let h = 0
  for (const ch of `${courtSet}:${cardId}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return SKIN_TONES[h % SKIN_TONES.length].id
}
