// Everything the browser does with online tables. Writes go through the
// `game` edge function (the server owns the match); reads are plain selects
// plus realtime, and your own hand comes from get_my_hand().
import { supabase, supabaseEnabled } from './supabase'

function friendly(message = '') {
  if (/Failed to send|NetworkError|Load failed|fetch/i.test(message)) return "Can't reach the table — check your connection."
  if (/FunctionsRelayError|FunctionsHttpError/.test(message)) return 'The table server had a problem — try again.'
  return message
}

export async function gameCall(body) {
  if (!supabaseEnabled) throw new Error('Online play is not set up on this build.')
  const { data, error } = await supabase.functions.invoke('game', { body })
  if (error) {
    let message = error.message
    try {
      const j = await error.context.json()
      message = j.error ?? message
    } catch {
      // not a JSON error body
    }
    const e = new Error(friendly(message))
    e.status = error.context?.status
    throw e
  }
  return data
}

export const createTable = (name, rules) => gameCall({ action: 'create', name, rules })
export const joinTable = (code, name) => gameCall({ action: 'join', code: String(code).trim(), name })
export const sitAt = (roomId, seat) => gameCall({ action: 'sit', roomId, seat })
export const leaveTable = (roomId) => gameCall({ action: 'leave', roomId })
export const startTable = (roomId) => gameCall({ action: 'start', roomId })
export const sendMove = (roomId, move) => gameCall({ action: 'act', roomId, move })
export const renameAtTable = (roomId, name) => gameCall({ action: 'rename', roomId, name })

export async function fetchRoom(roomId) {
  if (!supabaseEnabled) return null
  const { data, error } = await supabase.from('rooms').select('*').eq('id', roomId).maybeSingle()
  if (error) return null
  return data
}

export async function fetchMyHand(roomId) {
  if (!supabaseEnabled) return null
  const { data, error } = await supabase.rpc('get_my_hand', { p_room_id: roomId })
  if (error) return null
  return data
}

const OPEN_ROOM_MAX_AGE_MS = 30 * 60 * 1000
export async function listOpenRooms() {
  if (!supabaseEnabled) return []
  const cutoff = new Date(Date.now() - OPEN_ROOM_MAX_AGE_MS).toISOString()
  const { data, error } = await supabase
    .from('rooms')
    .select('id, code, host_id, host_name, players, settings, updated_at')
    .eq('status', 'waiting')
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) return []
  return data
}

export function subscribeRoom(roomId, onRow, onStatus) {
  if (!supabaseEnabled) return () => {}
  const channel = supabase
    .channel(`room-db:${roomId}:${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => onRow(payload.new))
    .subscribe((status) => onStatus?.(status))
  return () => supabase.removeChannel(channel)
}

// Low-latency extras that never touch the match: emotes, chat, presence.
export function openTableChannel(roomId, me, handlers) {
  if (!supabaseEnabled) return { send() {}, close() {} }
  const channel = supabase.channel(`table:${roomId}`, { config: { broadcast: { self: false }, presence: { key: me.id } } })
  channel.on('broadcast', { event: 'EMOTE' }, ({ payload }) => handlers.onEmote?.(payload))
  channel.on('broadcast', { event: 'CHAT' }, ({ payload }) => handlers.onChat?.(payload))
  channel.on('presence', { event: 'sync' }, () => handlers.onPresence?.(Object.keys(channel.presenceState())))
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') channel.track({ id: me.id, name: me.name, at: Date.now() }).catch(() => {})
  })
  return {
    send: (event, payload) => channel.send({ type: 'broadcast', event, payload }),
    close: () => supabase.removeChannel(channel),
  }
}

const avatarCache = new Map()
// Only real accounts have profiles. Bot seats (`__bot__2`) aren't UUIDs, and a
// single one makes Postgres reject the whole lookup (HTTP 400).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function fetchAvatars(ids) {
  const missing = ids.filter((id) => UUID.test(id) && !avatarCache.has(id))
  if (missing.length && supabaseEnabled) {
    const { data, error } = await supabase.from('profiles').select('id, avatar_url').in('id', missing)
    // Cache only a real answer: a failed lookup shouldn't blank everyone's avatar for the session.
    if (!error) for (const id of missing) avatarCache.set(id, data?.find((p) => p.id === id)?.avatar_url ?? '')
  }
  return Object.fromEntries(ids.map((id) => [id, avatarCache.get(id) ?? '']))
}
export function forgetAvatar(id) {
  avatarCache.delete(id)
}

export async function recordPracticeResult({ won, yourScore, opponentScore, rounds }) {
  if (!supabaseEnabled) return null
  const { data, error } = await supabase.rpc('record_practice_result', {
    p_won: won,
    p_your: yourScore,
    p_opp: opponentScore,
    p_rounds: rounds,
  })
  if (error) return null
  return data
}
