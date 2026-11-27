// Where players' own stickers live (the public `stickers` bucket, see the
// 20261129 migration), and a check that a link really points there. Kept free
// of the Supabase client so the table-talk lists (and their Node tests) can
// use it.
const BASE = (import.meta.env?.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
const PREFIX = '/storage/v1/object/public/stickers/'

// <user id>/<sticker id>_<w>x<h>.<ext>
const NAME = /^([0-9a-f-]{36})\/([0-9a-f-]{36})_(\d{2,3})x(\d{2,3})\.(webp|png|gif|jpg)$/i

export function ownStickerUrl(path) {
  return `${BASE}${PREFIX}${path}`
}

// { path, owner, id, w, h } for a link into our sticker bucket, else null.
export function parseOwnSticker(u) {
  if (!BASE) return null
  try {
    const url = new URL(u)
    const base = new URL(BASE)
    if (url.origin !== base.origin || !url.pathname.startsWith(PREFIX) || url.search || url.hash) return null
    const path = decodeURIComponent(url.pathname.slice(PREFIX.length))
    const m = NAME.exec(path)
    return m ? { path, owner: m[1], id: m[2], w: Number(m[3]), h: Number(m[4]) } : null
  } catch {
    return null
  }
}
