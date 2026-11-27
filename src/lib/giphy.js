// GIF and sticker search for table talk, through GIPHY.
//
// The key is a browser key (GIPHY wants every search sent straight from the
// player's browser) and lives in the VITE_GIPHY_KEY setting on Vercel, never
// in this public repo. Without it the GIF button just doesn't show.
//
// Family table rules: G-rated only, no video clips (they have sound), and
// searches or results about apes, pigs, alcohol, adult stuff, drugs or guns
// are dropped.
// GIFs always play silent. A beta key allows 100 searches an hour for the
// whole app, so results are cached and the picker offers ready-made searches.

const KEY = import.meta.env?.VITE_GIPHY_KEY ?? ''
export const gifsEnabled = !!KEY

const BLOCKED = /\b(monkeys?|apes?|gorillas?|chimps?|chimpanzees?|baboons?|orangutans?|pigs?|piggy|hogs?|swine|pork|bacon|ham|beers?|wine|vodka|whiske?y|tequila|drunk|alcohol|booze|cocktails?|sexy|twerk\w*|bikini|thirst\w*|weed|stoned|vap(e|ing)|cigarettes?|guns?)\b/i
export const isBlocked = (text) => BLOCKED.test(String(text ?? ''))

// Ready-made searches: one tap, no keyboard.
export const QUICK = {
  gifs: ['mic drop', 'too easy', 'you lose', 'bye', 'laughing', 'crying', 'shocked', 'celebrate', 'sit down', 'not impressed', 'deal with it', 'gg'],
  stickers: ['laughing', 'crying', 'mic drop', 'bye', 'fire', 'thumbs up', 'shocked', 'cards', 'crown', 'angry', 'bored', 'trophy'],
}

const cache = new Map()

// kind: 'gifs' | 'stickers'. Returns [{ id, title, url, w, h, thumb, sticker }].
export async function searchGiphy(kind, q, { offset = 0, signal } = {}) {
  const query = String(q ?? '').trim().slice(0, 50)
  if (!KEY || !query) return []
  if (isBlocked(query)) throw new GiphyError('blocked', 'Try a different search.')
  const cacheKey = `${kind}:${query.toLowerCase()}:${offset}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)
  const url = new URL(`https://api.giphy.com/v1/${kind === 'stickers' ? 'stickers' : 'gifs'}/search`)
  url.search = new URLSearchParams({ api_key: KEY, q: query, limit: '24', offset: String(offset), rating: 'g', lang: 'en', bundle: 'messaging_non_clips' })
  let res
  try {
    res = await fetch(url, { signal })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    throw new GiphyError('network', 'Couldn’t reach GIPHY. Check your connection.')
  }
  if (res.status === 429) throw new GiphyError('limit', 'GIF search is taking a breather — try again in a little while.')
  if (!res.ok) throw new GiphyError('http', 'GIF search isn’t working right now.')
  const body = await res.json()
  const items = (body.data ?? [])
    .filter((g) => !isBlocked(`${g.title} ${g.slug}`) && (g.rating ?? 'g') === 'g')
    .map((g) => toGif(g, kind === 'stickers'))
    .filter(Boolean)
  cache.set(cacheKey, items)
  return items
}

function toGif(g, sticker) {
  const big = g.images?.fixed_height
  const small = g.images?.fixed_height_small ?? big
  const url = big?.webp || big?.url
  if (!url || !safeGifUrl(url)) return null
  const thumb = small?.webp || small?.url || url
  return { id: String(g.id), title: g.title || 'GIF', url, thumb: safeGifUrl(thumb) ? thumb : url, w: Number(big.width) || 200, h: Number(big.height) || 200, sticker }
}

// Only GIPHY's own media servers, over https.
export function safeGifUrl(u) {
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && /^(media\d?|i)\.giphy\.com$/.test(url.hostname) && url.pathname.startsWith('/media/') && /\.(webp|gif)$/.test(url.pathname)
  } catch {
    return false
  }
}

export class GiphyError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}
