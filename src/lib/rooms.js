import { supabase, supabaseEnabled } from './supabase'

// Schema note: this talks to the existing `rooms` table (code, host_id,
// host_name, status, player_count, players jsonb, settings jsonb,
// game_state jsonb, ready_players jsonb) rather than a table this app
// invented — that table already has live data in it.

function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

// UI rules (src/data/challenges.js shape) <-> DB settings (flat, stringy) shape.
export function toDbSettings(rules) {
  return {
    nil: rules.standardNil !== false,
    jokers: !!rules.jokersWild,
    bagLimit: String(rules.bagLimit ?? 10),
    blindNil: !!rules.blindNil,
    winScore: String(rules.winScore ?? 500),
    doubleNil: !!rules.doubleNil,
    bagPenalty: rules.bagPenalty !== false,
    spadesBreak: rules.spadesBreakRule !== false,
    penaltyAmount: String(rules.nilBonus ?? 100),
  }
}

export function fromDbSettings(dbSettings = {}) {
  return {
    standardNil: dbSettings.nil !== false,
    jokersWild: !!dbSettings.jokers,
    bagLimit: Number(dbSettings.bagLimit ?? 10),
    blindNil: !!dbSettings.blindNil,
    winScore: Number(dbSettings.winScore ?? 500),
    doubleNil: !!dbSettings.doubleNil,
    bagPenalty: dbSettings.bagPenalty !== false,
    spadesBreakRule: dbSettings.spadesBreak !== false,
    nilBonus: Number(dbSettings.penaltyAmount ?? 100),
    partnershipMode: true,
  }
}

export async function createRoom(hostId, hostName, rules = {}, hostAvatarUrl = '') {
  if (!supabaseEnabled) throw new Error('Supabase is not configured.')
  const code = generateRoomCode()
  const { data, error } = await supabase
    .from('rooms')
    .insert({
      host_id: hostId,
      host_name: hostName,
      code,
      status: 'waiting',
      player_count: 1,
      players: [{ id: hostId, name: hostName, seat: 0, avatar_url: hostAvatarUrl }],
      settings: toDbSettings(rules),
      ready_players: [],
      game_state: {},
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listOpenRooms() {
  if (!supabaseEnabled) return []
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return []
  return data
}

export async function joinRoomByCode(code, player) {
  if (!supabaseEnabled) throw new Error('Supabase is not configured.')
  const { data: room, error } = await supabase.from('rooms').select('*').eq('code', code.trim()).single()
  if (error || !room) throw new Error('Room not found.')
  if (room.status === 'closed') throw new Error('That room has closed.')
  if (room.players.length >= 4) throw new Error('Room is full.')
  const takenSeats = new Set(room.players.map((p) => p.seat))
  let seat = 0
  while (takenSeats.has(seat)) seat++
  const updatedPlayers = [...room.players, { ...player, seat }]
  const { data, error: updateError } = await supabase
    .from('rooms')
    .update({ players: updatedPlayers, player_count: updatedPlayers.length })
    .eq('id', room.id)
    .select()
    .single()
  if (updateError) throw updateError
  return data
}

export async function updateRoom(roomId, patch) {
  if (!supabaseEnabled) return
  const { error } = await supabase
    .from('rooms')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', roomId)
  if (error) throw error
}

// Deep-merges `patch` into the room's game_state atomically on the server
// (via the merge_room_game_state Postgres function) instead of doing a
// client-side read-modify-write of the whole jsonb blob. Multiple players
// (and this client's own bot timers) can write different keys concurrently
// without one clobbering another's in-flight update.
export async function mergeGameState(roomId, patch) {
  if (!supabaseEnabled) return
  const { error } = await supabase.rpc('merge_room_game_state', { p_room_id: roomId, p_patch: patch })
  if (error) throw error
}

// Lets a player pick their own seat before the game starts, which is how
// teams get chosen — seats 0+2 are one partnership, 1+3 the other. Only
// moves into an empty seat; swapping with an occupied seat would require
// negotiating with the other player, which this simple model doesn't support.
export async function movePlayerToSeat(roomId, playerId, newSeat) {
  if (!supabaseEnabled) return
  const { data: room, error } = await supabase.from('rooms').select('players').eq('id', roomId).single()
  if (error || !room) throw error ?? new Error('Room not found.')
  if (room.players.some((p) => p.seat === newSeat)) throw new Error('That seat is taken.')
  const updated = room.players.map((p) => (p.id === playerId ? { ...p, seat: newSeat } : p))
  const { error: updateError } = await supabase.from('rooms').update({ players: updated }).eq('id', roomId)
  if (updateError) throw updateError
}

export async function replacePlayerWithBot(roomId, seat) {
  if (!supabaseEnabled) return
  const { data: room } = await supabase.from('rooms').select('players').eq('id', roomId).single()
  if (!room) return
  const updated = room.players.map((p) => (p.seat === seat ? { ...p, isBot: true, name: p.name?.endsWith(' (Bot)') ? p.name : `${p.name} (Bot)` } : p))
  await supabase.from('rooms').update({ players: updated }).eq('id', roomId)
}

export async function leaveRoom(roomId, playerId) {
  if (!supabaseEnabled) return
  const { data: room } = await supabase.from('rooms').select('players').eq('id', roomId).single()
  if (!room) return
  const remaining = room.players.filter((p) => p.id !== playerId)
  if (remaining.length === 0) {
    await supabase.from('rooms').update({ status: 'closed' }).eq('id', roomId)
  } else {
    await supabase.from('rooms').update({ players: remaining, player_count: remaining.length }).eq('id', roomId)
  }
}

export function subscribeToRoom(roomId, onChange) {
  if (!supabaseEnabled) return { unsubscribe() {} }
  const channel = supabase
    .channel(`room-db:${roomId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
      onChange(payload.new)
    })
    .subscribe()
  return { unsubscribe: () => supabase.removeChannel(channel) }
}

export function openGameChannel(roomId, handlers) {
  if (!supabaseEnabled) return { send() {}, unsubscribe() {} }
  const channel = supabase.channel(`game:${roomId}`, { config: { broadcast: { self: false } } })
  for (const [event, handler] of Object.entries(handlers)) {
    channel.on('broadcast', { event }, ({ payload }) => handler(payload))
  }
  channel.subscribe()
  return {
    send: (event, payload) => channel.send({ type: 'broadcast', event, payload }),
    unsubscribe: () => supabase.removeChannel(channel),
  }
}
