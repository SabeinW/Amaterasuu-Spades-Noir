// The AI players with their own accounts (Big Dre & Keisha, Jaylen & Nia,
// Malik & Jada): who they are, seating them at a table, and showing what
// they say. Their card play happens on the server (the `game` function);
// their talk comes from the `bots` function, and whoever's app asked for it
// shows it and sends it to the rest of the table over realtime, the same
// way a player's own emotes and chat go out. Their GIFs are searched here,
// in the browser, like everyone's.
import { supabase, supabaseEnabled } from './supabase'
import { gameCall } from './online'
import { gifsEnabled, giphySent, searchGiphy } from './giphy'
import { BOTS } from '../../supabase/functions/_shared/bots.js'

export { BOTS }

let accounts = null
let loading = null

// [{ id, persona, partner }] for every AI player, fetched once.
export function loadBotAccounts() {
  if (accounts) return Promise.resolve(accounts)
  if (!supabaseEnabled) return Promise.resolve([])
  loading ??= supabase
    .from('bot_accounts')
    .select('id, persona, partner')
    .then(({ data, error }) => {
      loading = null
      if (error) return []
      accounts = data ?? []
      return accounts
    })
  return loading
}

export const botAccountsNow = () => accounts ?? []
export const isAiAccount = (id) => !!accounts?.some((b) => b.id === id)
export const personaOf = (id) => accounts?.find((b) => b.id === id)?.persona ?? null
export const partnerAccountOf = (id) => {
  const me = accounts?.find((b) => b.id === id)
  return me ? accounts.find((b) => b.persona === me.partner) ?? null : null
}

// A seat held by one of these players (not a plain table bot).
export const isAiSeat = (p) => !!p?.isBot && !!p?.persona
export const tableHasAi = (players) => (players ?? []).some(isAiSeat)

export const addBotToTable = (roomId, botId) => gameCall({ action: 'add_bot', roomId, botId })
export const removeBotFromTable = (roomId, botId) => gameCall({ action: 'remove_bot', roomId, botId })

export async function askBots(body) {
  if (!supabaseEnabled) return { replies: [] }
  const { data, error } = await supabase.functions.invoke('bots', { body })
  if (error) return { replies: [] }
  return data ?? { replies: [] }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A GIF (or now and then a sticker) for what the bot wants to throw.
async function findGif(q) {
  if (!gifsEnabled || !q) return null
  const kind = Math.random() < 0.3 ? 'stickers' : 'gifs'
  try {
    const found = await searchGiphy(kind, q)
    const top = found.slice(0, 8)
    return top.length ? top[Math.floor(Math.random() * top.length)] : null
  } catch {
    return null
  }
}

// Shows each reply where it belongs and sends it to the table:
//   say   → the chat, and a speech bubble over the bot's seat
//   emoji → thrown at the table (skipped half the time when it also talks)
//   gif   → searched on GIPHY here and thrown like anyone's GIF
// `show` = { chat(author, text, seat), emote(payload) } draws it locally;
// `send(event, payload)` puts it on the table channel.
export async function playReplies(replies, { show, send, alive = () => true }) {
  let at = 0
  for (const r of replies ?? []) {
    await sleep(Math.max(0, (r.delay ?? 0) - at))
    at = r.delay ?? 0
    if (!alive()) return
    const tone = BOTS[r.persona]?.tone ?? 'brown'
    if (r.say) {
      show.chat(r.name, r.say, r.seat)
      send('CHAT', { author: r.name, text: r.say, seat: r.seat })
    }
    if (r.emoji && (!r.say || Math.random() < 0.5)) {
      await sleep(r.say ? 900 : 0)
      const payload = { seat: r.seat, kind: 'e', id: r.emoji, tone }
      show.emote(payload)
      send('EMOTE', payload)
    }
    if (r.gif) {
      const g = await findGif(r.gif)
      if (g && alive()) {
        await sleep(r.say ? 1600 : 0)
        const payload = { seat: r.seat, kind: 'g', id: g.id, url: g.url, w: g.w, h: g.h, st: !!g.sticker, emoji: '🎞️' }
        show.emote(payload)
        send('EMOTE', payload)
        giphySent(g)
      }
    }
  }
}
