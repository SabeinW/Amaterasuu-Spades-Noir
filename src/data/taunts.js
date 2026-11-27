// Table talk: the emojis and lines a player can throw at the table. They're
// sent over the wire by id, never as free text, so a player can only show
// what's on these lists.
//
// Kept clean for a family table (no swearing, nothing rude), and in line with
// the app's rules: no drinks, no pigs, no monkeys or apes, no music or bells.

// Hands and people that take a skin tone; they follow the sender's pick.
const TONED = new Set(['🫵', '👋', '🤏', '💪', '🙌', '👏', '🤝', '👊', '🧑‍🍳', '🙏', '🤦', '🤷'])

export const EMOJI_GROUPS = [
  {
    id: 'talk',
    label: 'Trash talk',
    items: ['🤡', '😂', '🫵', '💀', '🪦', '🧂', '🗑️', '🥱', '😴', '🍳', '🧹', '✂️', '🤫', '🙄', '😏', '😈', '🧢', '👋', '🍼', '🐢', '📉', '🤏', '🍿', '🧾', '🪑', '🐍', '💰', '🫠'],
  },
  {
    id: 'hype',
    label: 'Hype',
    items: ['🔥', '💯', '🐐', '👑', '😎', '💪', '🙌', '👏', '🤝', '👊', '🫡', '🎯', '⚡', '🧠', '🏆', '🚀', '🃏', '♠️', '🧑‍🍳', '🥶', '🤑'],
  },
  {
    id: 'react',
    label: 'Reactions',
    items: ['😮', '😳', '😬', '😭', '🥲', '😤', '🤯', '👀', '🙏', '🤔', '🫣', '😅', '🤦', '🤷', '😩', '🥵', '😱', '🤣', '🙃', '😇', '🫢'],
  },
]

// Short lines, shown as a speech bubble over the sender's seat.
export const LINES = [
  { id: 'set', text: 'Y’all getting set.', e: '😈', mood: 'talk' },
  { id: 'book', text: 'That’s my book.', e: '📚', mood: 'talk' },
  { id: 'bags', text: 'Bags on bags on bags.', e: '💰', mood: 'talk' },
  { id: 'cut', text: 'Cut ’em!', e: '✂️', mood: 'talk' },
  { id: 'easy', text: 'Too easy.', e: '🥱', mood: 'talk' },
  { id: 'taught', text: 'Who taught you to play?', e: '😂', mood: 'talk' },
  { id: 'sit', text: 'Sit down, rookie.', e: '🪑', mood: 'talk' },
  { id: 'cooked', text: 'Y’all cooked.', e: '🍳', mood: 'talk' },
  { id: 'scared', text: 'Scared money don’t make money.', e: '💸', mood: 'talk' },
  { id: 'notnil', text: 'Not the Nil…', e: '😬', mood: 'talk' },
  { id: 'boston', text: 'We ’bout to run a Boston.', e: '🧹', mood: 'talk' },
  { id: 'check', text: 'Check that card…', e: '👀', mood: 'talk' },
  { id: 'over', text: 'Pass the cards, it’s over.', e: '🃏', mood: 'talk' },
  { id: 'hurry', text: 'Hurry up, it’s not chess.', e: '⏳', mood: 'talk' },
  { id: 'weep', text: 'Read ’em and weep.', e: '😭', mood: 'talk' },
  { id: 'count', text: 'Count your books.', e: '🧮', mood: 'talk' },
  { id: 'respect', text: 'Respect the spade.', e: '♠️', mood: 'hype' },
  { id: 'runback', text: 'Run it back.', e: '🔁', mood: 'hype' },
  { id: 'partner', text: 'Partner, I got you.', e: '🤝', mood: 'partner' },
  { id: 'partnerwhat', text: 'Partner… what was that?', e: '🤦', mood: 'partner' },
  { id: 'mybad', text: 'My bad.', e: '😅', mood: 'nice' },
  { id: 'nice', text: 'Nice hand.', e: '👏', mood: 'nice' },
  { id: 'gg', text: 'GG — good game.', e: '🤝', mood: 'nice' },
]
const LINE_BY_ID = new Map(LINES.map((l) => [l.id, l]))
const ALL_EMOJI = new Set(EMOJI_GROUPS.flatMap((g) => g.items))
const GROUP_OF = new Map(EMOJI_GROUPS.flatMap((g) => g.items.map((e) => [e, g.id])))

// Skin tone picks (lib/skinTone.js) → emoji tone modifiers. Mix uses the default.
const TONE_MOD = { pale: '\u{1F3FB}', olive: '\u{1F3FC}', light: '\u{1F3FD}', brown: '\u{1F3FE}', deep: '\u{1F3FF}' }
export const emojiTone = (tone) => (TONE_MOD[tone] ? tone : 'brown')

export function withTone(emoji, tone) {
  if (!TONED.has(emoji)) return emoji
  const mod = TONE_MOD[emojiTone(tone)]
  const [first, ...rest] = [...emoji.replace(/️/g, '')]
  return first + mod + rest.join('')
}

// What goes over the wire. `emoji` is there for anyone still on an older
// version of the app, which shows it as is.
export function emotePayload(seat, pick, tone) {
  const t = emojiTone(tone)
  if (pick.kind === 'l') return { seat, kind: 'l', id: pick.id, tone: t, emoji: withTone(LINE_BY_ID.get(pick.id).e, t) }
  return { seat, kind: 'e', id: pick.id, tone: t, emoji: withTone(pick.id, t) }
}

// What a seat shows, from a payload or a local pick. Anything not on the
// lists is dropped. Older apps send just { seat, emoji }.
export function readEmote(p) {
  if (!p || typeof p !== 'object') return null
  const kind = p.kind ?? 'e'
  const id = p.id ?? p.emoji
  const tone = typeof p.tone === 'string' ? p.tone : 'brown'
  if (kind === 'l') {
    const line = LINE_BY_ID.get(id)
    return line ? { kind: 'l', key: id, text: line.text, emoji: withTone(line.e, tone) } : null
  }
  if (kind === 'e' && ALL_EMOJI.has(id)) return { kind: 'e', key: id, emoji: withTone(id, tone) }
  return null
}

// How a pick lands with the bots in practice: trash talk gets a comeback from
// the other side, hype and team talk get a nod from your partner.
export function moodOf(pick) {
  if (pick.kind === 'l') return LINE_BY_ID.get(pick.id)?.mood ?? 'talk'
  return GROUP_OF.get(pick.id) ?? 'react'
}

// What the practice bots say, by moment. Each entry is a pick: e = emoji, l = line.
const e = (id) => ({ kind: 'e', id })
const l = (id) => ({ kind: 'l', id })
export const BOT_TALK = {
  setThem: [l('cooked'), l('set'), l('sit'), l('weep'), e('🤡'), e('💀'), e('🪦'), e('🧹'), e('😈')],
  gotSet: [e('😤'), e('😭'), e('🧂'), e('😩'), e('🫠'), e('🙄'), l('runback')],
  cut: [l('cut'), e('✂️'), e('😏'), e('😈'), e('🔥')],
  nilBust: [l('notnil'), e('🫵'), e('😂'), e('🤣')],
  nilMade: [e('😎'), e('🫡'), e('💯')],
  comeback: [e('🙄'), e('🥱'), e('🤫'), e('🧢'), e('😂'), l('taught'), l('easy'), l('check'), l('count')],
  partnerHype: [e('🤝'), e('🔥'), e('💯'), e('👊'), l('partner')],
  partnerSorry: [l('mybad'), e('😅'), e('🤷')],
  nice: [l('gg'), e('🤝'), e('🫡')],
}
export const pickFrom = (list) => list[Math.floor(Math.random() * list.length)]

// Recently used picks, newest first, kept on this device.
const RECENT_KEY = 'amaterasuu-noir-spades:emote-recent'
export function recentPicks() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return (Array.isArray(v) ? v : []).filter((p) => readEmote(p)).slice(0, 14)
  } catch {
    return []
  }
}
export function rememberPick(pick) {
  const list = [pick, ...recentPicks().filter((p) => !(p.kind === pick.kind && p.id === pick.id))].slice(0, 14)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.map(({ kind, id }) => ({ kind, id }))))
  } catch {
    // storage unavailable: recents just don't stick
  }
}
