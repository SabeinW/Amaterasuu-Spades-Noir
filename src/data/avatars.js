// Avatar system — supports either a picked emoji + background color, or a
// real photo the user uploads from their device. There's no Supabase
// Storage bucket provisioned for this project (and the anon key can't
// create one), so uploaded photos are resized/compressed client-side and
// stored directly as a data: URI in profiles.avatar_url (a plain `text`
// column) — no extra infrastructure required.

export const AVATAR_EMOJIS = [
  '🎩', '👑', '🦁', '🐺', '🃏', '🎭', '🔥', '⚡',
  '🌟', '💎', '🎯', '🚀', '🦊', '🐉', '🎪', '🎨',
  '🍀', '🌙', '☄️', '🦄', '🐙', '🎸', '🏆', '👽',
]

export const AVATAR_COLORS = [
  '#a78bfa', '#38bdf8', '#ec4899', '#f97316',
  '#22c55e', '#f5d90a', '#ef4444', '#7dd3fc',
]

export const DEFAULT_AVATAR = { kind: 'emoji', emoji: '🎩', color: '#a78bfa' }

const PHOTO_SIZE = 160
const PHOTO_QUALITY = 0.85
// A data: URI at this size/quality lands well under this — the cap just
// guards against pathologically large uploads slipping through.
const MAX_PHOTO_BYTES = 300_000

export function parseAvatar(avatarUrl) {
  if (!avatarUrl) return DEFAULT_AVATAR
  if (avatarUrl.startsWith('data:image/') || avatarUrl.startsWith('http')) {
    return { kind: 'photo', url: avatarUrl }
  }
  try {
    const parsed = JSON.parse(avatarUrl)
    if (parsed?.emoji && parsed?.color) return { kind: 'emoji', emoji: parsed.emoji, color: parsed.color }
  } catch {
    // legacy/plain-string avatar_url values fall through to the default
  }
  return DEFAULT_AVATAR
}

export function serializeAvatar(avatar) {
  return JSON.stringify({ emoji: avatar.emoji, color: avatar.color })
}

// Center-crops to a square, downsamples to PHOTO_SIZE, and re-encodes as a
// compressed JPEG data URI — keeps the profiles.avatar_url text column
// small regardless of how large the original photo was.
export function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'))
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
