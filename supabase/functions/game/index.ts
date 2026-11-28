// The `game` edge function: the only thing allowed to write a room.
//
// Every request: who's calling (from their JWT) + what they want to do. The
// function reads the room, applies the action with the shared rules engine
// (../_shared/engine.js), plays any bot / away seats, and commits with an
// optimistic version check so two moves can never interleave. Clients just
// render whatever lands in rooms.game_state (realtime) and read their own
// hand with get_my_hand().
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as E from '../_shared/engine.js'
import { BOSS, PRO } from '../_shared/pro.js'
import { BOTS } from '../_shared/bots.js'

// An AI player with its own account (Big Dre, Keisha, …) sits as a real
// profile id with isBot + persona, and plays with the pro brain.
type Player = { id: string; name: string; seat: number; isBot?: boolean; persona?: string; left?: boolean }
type Room = {
  id: string
  code: string
  host_id: string
  host_name: string
  status: 'waiting' | 'playing' | 'closed'
  players: Player[]
  settings: Record<string, unknown>
  game_state: any
  version: number
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BOT_NAMES = ['Sora', 'Noctis', 'Sakura', 'Kenji', 'Hoshi', 'Ren']
const STALE_PLAYING_MS = 6 * 60 * 60 * 1000
const STALE_WAITING_MS = 45 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function cleanName(name: unknown, fallback: string) {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 24)
  return s || fallback
}

function control(players: Player[]) {
  return [0, 1, 2, 3].map((seat) => {
    const p = players.find((x) => x.seat === seat)
    if (!p) return 'bot'
    if (p.isBot) return p.persona ? (BOTS[p.persona as keyof typeof BOTS]?.boss ? 'boss' : 'pro') : 'bot'
    if (p.left) return 'away'
    return 'human'
  })
}

function isRealUser(p: Player) {
  return UUID.test(p.id)
}

// A person (not a table bot, not an AI player).
function isHuman(p: Player) {
  return isRealUser(p) && !p.isBot
}

// The AI players' thinking is slow next to the quick rules, and a request
// only gets about 2 s of CPU on Supabase. So each request has a thinking
// budget shared by every pro/boss move it makes (several, if a few AI
// players move in a row or a conflict makes it run again); once it's spent
// they move by the quick rules for the rest of that request.
type Budget = { ms: number }
const THINK_MS = 700
function budgeted(brain: typeof PRO, budget: Budget) {
  const run = <T,>(fn: () => T): T | null => {
    if (budget.ms >= THINK_MS) return null
    const t = performance.now()
    try {
      return fn()
    } finally {
      budget.ms += performance.now() - t
    }
  }
  return {
    bid: (...a: Parameters<typeof PRO.bid>) => run(() => brain.bid(...a)),
    card: (...a: Parameters<typeof PRO.card>) => run(() => brain.card(...a)),
  }
}
function ctxFor(players: Player[], budget: Budget) {
  return { now: Date.now(), rng, control: control(players), brains: { pro: budgeted(PRO, budget), boss: budgeted(BOSS, budget) } }
}

async function loadRoom(roomId: string) {
  const { data: room, error } = await admin.from('rooms').select('*').eq('id', roomId).maybeSingle()
  if (error) throw error
  if (!room) throw new HttpError(404, 'Room not found.')
  const { data: secret } = await admin.from('room_secrets').select('hands').eq('room_id', roomId).maybeSingle()
  return { room: room as Room, hands: (secret?.hands ?? null) as any[] | null }
}

type Change = { patch: Partial<Room> & { player_count?: number }; hands?: any[] | null } | null

// Read → change → commit-if-unchanged, retried on conflict.
async function mutate(roomId: string, change: (room: Room, hands: any[] | null) => Change) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { room, hands } = await loadRoom(roomId)
    const before = structuredClone(room)
    const out = change(structuredClone(room), hands ? structuredClone(hands) : null)
    if (!out) return { room, hands, before }
    const { data: version, error } = await admin.rpc('commit_room', {
      p_room_id: roomId,
      p_version: room.version,
      p_room: out.patch,
      p_hands: out.hands ?? null,
    })
    if (error) throw error
    if (version !== null) return { room: { ...room, ...out.patch, version } as Room, hands: out.hands ?? hands, before }
    await sleep(25 + Math.random() * 90 * (attempt + 1))
  }
  throw new HttpError(409, 'The table is busy — try that again.')
}

function seatOf(room: Room, userId: string) {
  return room.players.find((p) => p.id === userId) ?? null
}

// Recompute automation after seat control changed (join, leave, bot swap).
function refreshed(room: Room, hands: any[] | null, budget: Budget) {
  if (room.status !== 'playing' || !hands || !room.game_state?.v) return { game_state: room.game_state, hands }
  const full = { pub: room.game_state, hands }
  E.refresh(full, ctxFor(room.players, budget))
  return { game_state: full.pub, hands: full.hands }
}

async function recordResults(room: Room) {
  const pub = room.game_state
  if (!pub?.winner) return
  for (const p of room.players) {
    if (!isRealUser(p)) continue
    const team = E.teamOf(p.seat)
    const other = team === 'A' ? 'B' : 'A'
    await admin.rpc('apply_match_result', {
      p_user: p.id,
      p_won: pub.winner === team,
      p_your: pub.scores[team].total,
      p_opp: pub.scores[other].total,
      p_rounds: pub.round,
    })
  }
  // The AI players remember every game they finish (the `bots` function
  // reads these back so they can bring up old wins and losses).
  const ai = room.players.filter((p) => p.isBot && p.persona && isRealUser(p))
  if (ai.length) {
    const rows = ai.map((b) => {
      const team = E.teamOf(b.seat)
      const other = team === 'A' ? 'B' : 'A'
      return {
        bot_id: b.id,
        room_id: room.id,
        won: pub.winner === team,
        us: pub.scores[team].total,
        them: pub.scores[other].total,
        rounds: pub.round,
        people: room.players.filter(isHuman).map((p) => ({ id: p.id, name: p.name, side: E.teamOf(p.seat) === team ? 'partner' : 'opponent' })),
      }
    })
    const { error } = await admin.from('bot_games').insert(rows)
    if (error) console.error('bot_games', error.message)
  }
}

async function sweepStaleRooms() {
  const now = Date.now()
  await admin
    .from('rooms')
    .update({ status: 'closed' })
    .eq('status', 'playing')
    .lt('updated_at', new Date(now - STALE_PLAYING_MS).toISOString())
  await admin
    .from('rooms')
    .update({ status: 'closed' })
    .eq('status', 'waiting')
    .lt('updated_at', new Date(now - STALE_WAITING_MS).toISOString())
}

async function handle(userId: string, body: any) {
  const action = String(body?.action ?? '')
  const budget: Budget = { ms: 0 }

  if (action === 'create') {
    sweepStaleRooms().catch(() => {})
    const name = cleanName(body.name, 'Player')
    const settings = E.normalizeRules(body.rules ?? {})
    for (let i = 0; i < 15; i++) {
      const code = String(Math.floor(1000 + rng() * 9000))
      const { data, error } = await admin
        .from('rooms')
        .insert({
          code,
          host_id: userId,
          host_name: name,
          status: 'waiting',
          player_count: 1,
          players: [{ id: userId, name, seat: 0 }],
          settings,
          ready_players: [],
          game_state: {},
          version: 0,
        })
        .select()
        .single()
      if (!error) return { room: data }
      if (error.code !== '23505') throw error
    }
    throw new HttpError(503, 'Could not find a free room code — try again.')
  }

  if (action === 'join') {
    const code = String(body.code ?? '').trim()
    if (!/^\d{4}$/.test(code)) throw new HttpError(400, 'Room codes are 4 digits.')
    const { data: found } = await admin
      .from('rooms')
      .select('id')
      .eq('code', code)
      .in('status', ['waiting', 'playing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!found) throw new HttpError(404, 'No open table with that code.')
    const name = cleanName(body.name, 'Player')
    const res = await mutate(found.id, (room, hands) => {
      const me = seatOf(room, userId)
      if (me) {
        if (!me.left && !me.isBot && me.name === name) return null
        room.players = room.players.map((p) => (p.id === userId ? { ...p, name, left: false, isBot: false } : p))
        const r = refreshed(room, hands, budget)
        return { patch: { players: room.players, game_state: r.game_state }, hands: r.hands }
      }
      if (room.status === 'waiting') {
        if (room.players.length >= 4) throw new HttpError(409, 'That table is full.')
        const taken = new Set(room.players.map((p) => p.seat))
        let seat = 0
        while (taken.has(seat)) seat++
        room.players = [...room.players, { id: userId, name, seat }]
        return { patch: { players: room.players, player_count: room.players.length } }
      }
      // Game already running: take over a bot seat if there is one.
      const botSeat = room.players.find((p) => p.isBot && !isRealUser(p))
      if (!botSeat) throw new HttpError(409, 'That game is full.')
      room.players = room.players.map((p) => (p === botSeat ? { id: userId, name, seat: p.seat } : p))
      const r = refreshed(room, hands, budget)
      return { patch: { players: room.players, game_state: r.game_state }, hands: r.hands }
    })
    return { room: res.room, hand: res.hands ? handFor(res.room, res.hands, userId) : null }
  }

  const roomId = String(body.roomId ?? '')
  if (!UUID.test(roomId)) throw new HttpError(400, 'Missing room.')

  if (action === 'sit') {
    const seat = Number(body.seat)
    if (![0, 1, 2, 3].includes(seat)) throw new HttpError(400, 'Pick a seat 1–4.')
    const res = await mutate(roomId, (room) => {
      if (room.status !== 'waiting') throw new HttpError(409, 'The game already started.')
      const me = seatOf(room, userId)
      if (!me) throw new HttpError(403, "You're not at this table.")
      if (me.seat === seat) return null
      if (room.players.some((p) => p.seat === seat)) throw new HttpError(409, 'That seat is taken.')
      room.players = room.players.map((p) => (p.id === userId ? { ...p, seat } : p))
      return { patch: { players: room.players } }
    })
    return { room: res.room }
  }

  if (action === 'leave') {
    const res = await mutate(roomId, (room, hands) => {
      const me = seatOf(room, userId)
      if (!me) return null
      if (room.status === 'waiting') {
        const rest = room.players.filter((p) => p.id !== userId)
        const people = rest.filter(isHuman)
        // AI players don't keep a table open on their own.
        if (!people.length) return { patch: { status: 'closed', players: [], player_count: 0 } }
        const patch: Partial<Room> & { player_count?: number } = { players: rest, player_count: rest.length }
        if (room.host_id === userId) {
          patch.host_id = people[0].id
          patch.host_name = people[0].name
        }
        return { patch }
      }
      if (me.left) return null
      room.players = room.players.map((p) => (p.id === userId ? { ...p, left: true } : p))
      const anyoneHere = room.players.some((p) => isRealUser(p) && !p.left && !p.isBot)
      if (!anyoneHere && room.game_state?.phase === 'game_over') return { patch: { players: room.players, status: 'closed' } }
      const r = refreshed(room, hands, budget)
      return { patch: { players: room.players, game_state: r.game_state }, hands: r.hands }
    })
    return { room: res.room }
  }

  if (action === 'start') {
    const res = await mutate(roomId, (room) => {
      if (room.host_id !== userId) throw new HttpError(403, 'Only the host can start.')
      if (room.status !== 'waiting') return null
      const players = [...room.players]
      let b = 0
      const used = new Set(players.map((p) => p.name))
      for (let seat = 0; seat < 4; seat++) {
        if (!players.some((p) => p.seat === seat)) {
          let name = BOT_NAMES[b++ % BOT_NAMES.length]
          while (used.has(name)) name = BOT_NAMES[b++ % BOT_NAMES.length]
          used.add(name)
          players.push({ id: `__bot__${seat}`, name, seat, isBot: true })
        }
      }
      const full = E.createMatch(room.settings, rng)
      E.startMatch(full, ctxFor(players, budget))
      return { patch: { status: 'playing', players, player_count: 4, game_state: full.pub }, hands: full.hands }
    })
    return { room: res.room, hand: res.hands ? handFor(res.room, res.hands, userId) : null }
  }

  if (action === 'act') {
    const move = body.move ?? {}
    const res = await mutate(roomId, (room, hands) => {
      if (room.status !== 'playing' || !hands || !room.game_state?.v) throw new HttpError(409, "This table isn't playing right now.")
      const me = seatOf(room, userId)
      if (!me) throw new HttpError(403, "You're not at this table.")
      // Acting means you're here: take your seat back from the bot.
      const reclaimed = !!(me.left || me.isBot)
      if (reclaimed) room.players = room.players.map((p) => (p.id === userId ? { ...p, left: false, isBot: false } : p))
      const full = { pub: room.game_state, hands }
      const before = JSON.stringify(full.pub)
      E.act(full, me.seat, move, ctxFor(room.players, budget))
      if (!reclaimed && JSON.stringify(full.pub) === before) return null
      return { patch: { players: room.players, game_state: full.pub }, hands: full.hands }
    })
    if (res.before.game_state?.phase !== 'game_over' && res.room.game_state?.phase === 'game_over') {
      await recordResults(res.room)
    }
    return { room: res.room, hand: res.hands ? handFor(res.room, res.hands, userId) : null }
  }

  // Seat one of the AI players at a table that hasn't started. Anyone at
  // the table may, if they're friends with that player or with its partner
  // (the couples come as a pair). They take the other team's side from
  // whoever invited them, across from their partner.
  if (action === 'add_bot') {
    const botId = String(body.botId ?? '')
    if (!UUID.test(botId)) throw new HttpError(400, 'Missing player.')
    const { data: all, error } = await admin.from('bot_accounts').select('id, persona, partner')
    if (error) throw error
    const bot = (all ?? []).find((b) => b.id === botId)
    if (!bot || !BOTS[bot.persona as keyof typeof BOTS]) throw new HttpError(404, "That player isn't one of the AI players.")
    const pair = (all ?? []).filter((b) => b.id === botId || b.persona === bot.partner).map((b) => b.id)
    const list = pair.join(',')
    const { data: friendship } = await admin
      .from('friends')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(user_id.eq.${userId},friend_id.in.(${list})),and(friend_id.eq.${userId},user_id.in.(${list}))`)
      .limit(1)
    if (!friendship?.length) throw new HttpError(403, 'Add them as a friend first.')
    const { data: profile } = await admin.from('profiles').select('username').eq('id', botId).maybeSingle()
    const name = cleanName(profile?.username, BOTS[bot.persona as keyof typeof BOTS].name)
    const res = await mutate(roomId, (room) => {
      if (room.status !== 'waiting') throw new HttpError(409, 'The game already started.')
      const me = seatOf(room, userId)
      if (!me) throw new HttpError(403, "You're not at this table.")
      if (room.players.some((p) => p.id === botId)) return null
      if (room.players.length >= 4) throw new HttpError(409, 'The table is full.')
      const taken = new Set(room.players.map((p) => p.seat))
      const free = (s: number) => !taken.has(s)
      const partnerSeat = room.players.find((p) => p.persona === bot.partner)?.seat
      let seat: number | undefined
      if (partnerSeat !== undefined && free((partnerSeat + 2) % 4)) seat = (partnerSeat + 2) % 4
      if (seat === undefined) {
        const theirs = [(me.seat + 1) % 4, (me.seat + 3) % 4].filter(free)
        seat = theirs.find((s) => free((s + 2) % 4)) ?? theirs[0] ?? [0, 1, 2, 3].find(free)
      }
      if (seat === undefined) throw new HttpError(409, 'The table is full.')
      room.players = [...room.players, { id: botId, name, seat, isBot: true, persona: bot.persona }]
      return { patch: { players: room.players, player_count: room.players.length } }
    })
    return { room: res.room }
  }

  if (action === 'remove_bot') {
    const botId = String(body.botId ?? '')
    const res = await mutate(roomId, (room) => {
      if (room.status !== 'waiting') throw new HttpError(409, 'The game already started.')
      if (!seatOf(room, userId)) throw new HttpError(403, "You're not at this table.")
      const rest = room.players.filter((p) => !(p.id === botId && p.persona))
      if (rest.length === room.players.length) return null
      return { patch: { players: rest, player_count: rest.length } }
    })
    return { room: res.room }
  }

  if (action === 'rename') {
    const name = cleanName(body.name, 'Player')
    const res = await mutate(roomId, (room) => {
      const me = seatOf(room, userId)
      if (!me || me.name === name) return null
      room.players = room.players.map((p) => (p.id === userId ? { ...p, name } : p))
      const patch: Partial<Room> = { players: room.players }
      if (room.host_id === userId) patch.host_name = name
      return { patch }
    })
    return { room: res.room }
  }

  throw new HttpError(400, `Unknown action "${action}".`)
}

function handFor(room: Room, hands: any[], userId: string) {
  const me = seatOf(room, userId)
  return me ? hands[me.seat] ?? [] : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return json({ error: 'Please sign in to play online.' }, 401)
    const body = await req.json().catch(() => ({}))
    const result = await handle(data.user.id, body)
    return json({ ...result, now: Date.now() })
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    if (e instanceof E.EngineError) return json({ error: e.message, code: e.code }, 409)
    console.error(e)
    return json({ error: 'Something went wrong on the server.' }, 500)
  }
})
