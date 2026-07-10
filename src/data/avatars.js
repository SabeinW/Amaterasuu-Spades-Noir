// Lightweight avatar system — no image upload/storage needed. Users pick an
// emoji + background color; both get packed into profiles.avatar_url as a
// small JSON string (that column is just `text`, so this is a safe reuse).

export const AVATAR_EMOJIS = [
  '🎩', '👑', '🦁', '🐺', '🃏', '🎭', '🔥', '⚡',
  '🌟', '💎', '🎯', '🚀', '🦊', '🐉', '🎪', '🎨',
  '🍀', '🌙', '☄️', '🦄', '🐙', '🎸', '🏆', '👽',
]

export const AVATAR_COLORS = [
  '#a78bfa', '#38bdf8', '#ec4899', '#f97316',
  '#22c55e', '#f5d90a', '#ef4444', '#7dd3fc',
]

export const DEFAULT_AVATAR = { emoji: '🎩', color: '#a78bfa' }

export function parseAvatar(avatarUrl) {
  if (!avatarUrl) return DEFAULT_AVATAR
  try {
    const parsed = JSON.parse(avatarUrl)
    if (parsed?.emoji && parsed?.color) return parsed
  } catch {
    // legacy/plain-string avatar_url values fall through to the default
  }
  return DEFAULT_AVATAR
}

export function serializeAvatar(avatar) {
  return JSON.stringify({ emoji: avatar.emoji, color: avatar.color })
}
