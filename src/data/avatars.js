// Avatar system — supports either a picked emoji + background color, or a
// real photo/GIF the user uploads from their device, each optionally with a
// decorative border. There's no Supabase Storage bucket provisioned for
// this project (and the anon key can't create one), so uploads are
// resized/compressed client-side and stored directly as a data: URI in
// profiles.avatar_url (a plain `text` column) — no extra infrastructure
// required.

export const AVATAR_EMOJIS = [
  '🎩', '👑', '🦁', '🐺', '🃏', '🎭', '🔥', '⚡',
  '🌟', '💎', '🎯', '🚀', '🦊', '🐉', '🎪', '🎨',
  '🍀', '🌙', '☄️', '🦄', '🐙', '🎸', '🏆', '👽',
]

export const AVATAR_COLORS = [
  '#a78bfa', '#38bdf8', '#ec4899', '#f97316',
  '#22c55e', '#f5d90a', '#ef4444', '#7dd3fc',
]

export const DEFAULT_AVATAR = { kind: 'emoji', emoji: '🎩', color: '#a78bfa', border: null }

const BOT_AVATAR_EMOJIS = ['🤖', '👾', '🦾', '🎲', '🧠', '🔮', '🦉', '🐺', '🦊', '🐉', '🦁', '🧿', '⚙️', '🎯', '🐙']

// A stable-per-name hash so the same bot always gets the same face across
// renders and games, instead of a single generic robot icon for all of them
// — makes a table of bots feel like distinct opponents rather than clones.
export function botAvatar(name) {
  const clean = (name ?? '').replace(/^[^\p{L}\p{N}]+/u, '').trim() || 'Bot'
  let hash = 0
  for (let i = 0; i < clean.length; i++) hash = (hash * 31 + clean.charCodeAt(i)) >>> 0
  return {
    kind: 'emoji',
    emoji: BOT_AVATAR_EMOJIS[hash % BOT_AVATAR_EMOJIS.length],
    color: AVATAR_COLORS[hash % AVATAR_COLORS.length],
    border: null,
  }
}

const PHOTO_SIZE = 160
const PHOTO_QUALITY = 0.85
// A data: URI at this size/quality lands well under this — the cap just
// guards against pathologically large uploads slipping through.
const MAX_PHOTO_BYTES = 300_000
// GIFs can't be resized through a canvas without losing their animation
// (canvas only ever captures a single frame), so an uploaded GIF is stored
// as-is instead of recompressed — capped higher than a static photo since
// there's no compression pass to shrink it first.
const MAX_GIF_BYTES = 900_000

export const PROFILE_BORDERS = [
  { id: 'gold', name: 'Gold', ring: '#f5d90a', glow: '#f5d90a99' },
  { id: 'platinum', name: 'Platinum', ring: '#e2e8f0', glow: '#e2e8f099' },
  { id: 'amethyst', name: 'Amethyst', ring: '#a78bfa', glow: '#a78bfa99' },
  { id: 'sapphire', name: 'Sapphire', ring: '#38bdf8', glow: '#38bdf899' },
  { id: 'emerald', name: 'Emerald', ring: '#4ade80', glow: '#4ade8099' },
  { id: 'crimson', name: 'Crimson', ring: '#ef4444', glow: '#ef444499' },
  { id: 'rose', name: 'Rose Gold', ring: '#f0a8a0', glow: '#f0a8a099' },
  { id: 'rainbow', name: 'Rainbow', ring: null, glow: null, rainbow: true },
]

export function borderStyle(borderId, sizePx) {
  const border = PROFILE_BORDERS.find((b) => b.id === borderId)
  if (!border) return {}
  if (border.rainbow) {
    return {
      padding: 2,
      background: 'conic-gradient(from 0deg, #a78bfa, #38bdf8, #4ade80, #f5d90a, #fb4f6f, #a78bfa)',
      borderRadius: '9999px',
      boxShadow: '0 0 10px rgba(167,139,250,0.5)',
    }
  }
  return {
    padding: 2,
    background: border.ring,
    borderRadius: '9999px',
    boxShadow: `0 0 ${Math.max(8, (sizePx ?? 32) * 0.3)}px ${border.glow}`,
  }
}

// Handles both the legacy raw-string encodings (a bare data:/http URL for a
// photo, or a `{emoji,color}` JSON blob with no border) and the current
// unified `{kind, ...}` JSON scheme, so old profile rows keep rendering.
export function parseAvatar(avatarUrl) {
  if (!avatarUrl) return DEFAULT_AVATAR
  if (avatarUrl.startsWith('data:image/') || avatarUrl.startsWith('http')) {
    return { kind: 'photo', url: avatarUrl, border: null }
  }
  try {
    const parsed = JSON.parse(avatarUrl)
    if (parsed?.kind === 'photo' && parsed.url) return { kind: 'photo', url: parsed.url, border: parsed.border ?? null }
    if (parsed?.emoji && parsed?.color) return { kind: 'emoji', emoji: parsed.emoji, color: parsed.color, border: parsed.border ?? null }
  } catch {
    // legacy/plain-string avatar_url values fall through to the default
  }
  return DEFAULT_AVATAR
}

export function serializeAvatar(avatar) {
  if (avatar.kind === 'photo') {
    return JSON.stringify({ kind: 'photo', url: avatar.url, border: avatar.border ?? null })
  }
  return JSON.stringify({ kind: 'emoji', emoji: avatar.emoji, color: avatar.color, border: avatar.border ?? null })
}

// Center-crops to a square and downsamples for a static photo. A GIF is
// read through as-is (skipping the canvas pass entirely) so it keeps its
// animation — canvas.toDataURL only ever captures one frame.
export function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'))
      return
    }
    if (file.type === 'image/gif') {
      if (file.size > MAX_GIF_BYTES) {
        reject(new Error('That GIF is too large — try one under 900KB.'))
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error("Couldn't read that GIF."))
      reader.readAsDataURL(file)
      return
    }
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const side = Math.min(img.width, img.height)
      const sx = (img.width - side) / 2
      const sy = (img.height - side) / 2
      const canvas = document.createElement('canvas')
      canvas.width = PHOTO_SIZE
      canvas.height = PHOTO_SIZE
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
      const dataUrl = canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
      if (dataUrl.length > MAX_PHOTO_BYTES) {
        reject(new Error('That image is too large — try a different photo.'))
        return
      }
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Couldn't read that image."))
    }
    img.src = objectUrl
  })
}
