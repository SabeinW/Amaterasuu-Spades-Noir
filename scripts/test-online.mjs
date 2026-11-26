// End-to-end check of online play against the LOCAL Supabase stack:
//   npx supabase start && npx supabase functions serve   (in another shell)
//   node scripts/test-online.mjs
//
// Four real accounts create/join a room, play a whole match through the
// `game` edge function, and the test checks the things that used to break:
// hidden hands, server-side validation, nobody able to write rooms directly,
// leave/rejoin mid-match, concurrent moves, realtime delivery, and stats.
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import * as E from '../supabase/functions/_shared/engine.js'

const env = Object.fromEntries(
  execSync('npx -y supabase@latest status -o env', { encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    })
)
const URL = env.API_URL
const KEY = env.ANON_KEY

let failures = 0
const check = (cond, msg) => {
  if (!cond) {
    failures++
    console.error('  FAIL:', msg)
  } else if (process.env.VERBOSE) console.log('  ok:', msg)
}

async function makePlayer(label) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`
  const { data, error } = await client.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  await client.from('profiles').insert({ id: data.user.id, email, username: `${label}${Math.floor(Math.random() * 1e5)}` })
  const call = async (body) => {
    const { data: res, error: err } = await client.functions.invoke('game', { body })
    if (err) {
      let msg = err.message
      try {
        msg = (await err.context.json()).error ?? msg
      } catch {}
      const e = new Error(msg)
      e.status = err.context?.status
      throw e
    }
    return res
  }
  return { label, client, id: data.user.id, call }
}

async function expectError(promise, status, msg) {
  try {
    await promise
    check(false, `${msg} (expected HTTP ${status})`)
  } catch (e) {
    check(!status || e.status === status, `${msg} → ${e.status} ${e.message}`)
  }
}

const readRoom = async (p, id) => (await p.client.from('rooms').select('*').eq('id', id).single()).data

console.log('setting up 4 players…')
const [host, a, b, c] = await Promise.all(['host', 'amy', 'ben', 'cal'].map(makePlayer))

// --- lobby ---------------------------------------------------------------
const created = await host.call({ action: 'create', name: 'Host', rules: { winScore: 120, jokersWild: true, blindNil: true } })
const room0 = created.room
check(/^\d{4}$/.test(room0.code), `room code ${room0.code}`)
check(room0.players.length === 1 && room0.players[0].seat === 0, 'host sits in seat 0')

await expectError(host.client.from('rooms').update({ status: 'playing' }).eq('id', room0.id).then(({ error }) => { if (error) { const e = new Error(error.message); e.status = 403; throw e } }), 403, 'clients cannot update rooms directly')
{
  const { error } = await host.client.from('rooms').insert({ code: '0000', host_id: host.id, host_name: 'x' })
  check(!!error, 'clients cannot insert rooms directly')
}

await a.call({ action: 'join', code: room0.code, name: 'Amy' })
await b.call({ action: 'join', code: room0.code, name: 'Ben' })
await expectError(a.call({ action: 'start', roomId: room0.id }), 403, 'only the host can start')
await a.call({ action: 'sit', roomId: room0.id, seat: 3 })
await expectError(b.call({ action: 'sit', roomId: room0.id, seat: 3 }), 409, 'cannot take an occupied seat')
await expectError(c.call({ action: 'join', code: '0001', name: 'Cal' }), 404, 'bad code is rejected')
await c.call({ action: 'join', code: room0.code, name: 'Cal' })
{
  const r = await readRoom(host, room0.id)
  const seats = Object.fromEntries(r.players.map((p) => [p.name, p.seat]))
  check(seats.Host === 0 && seats.Amy === 3 && seats.Cal !== undefined && new Set(Object.values(seats)).size === 4, `seats ${JSON.stringify(seats)}`)
}
await expectError(makePlayer('dan').then((d) => d.call({ action: 'join', code: room0.code, name: 'Dan' })), 409, 'fifth player is turned away')

// --- realtime listener -----------------------------------------------------
let realtimeUpdates = 0
const channel = c.client
  .channel('test-room')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room0.id}` }, () => realtimeUpdates++)
await new Promise((res) => channel.subscribe((s) => s === 'SUBSCRIBED' && res()))

// --- start ---------------------------------------------------------------
const started = await host.call({ action: 'start', roomId: room0.id })
check(started.room.status === 'playing', 'room is playing')
check(Array.isArray(started.hand) && started.hand.length === 13, 'host gets their 13 cards back from start')
const players = [host, a, b, c]
const bySeat = {}
for (const p of started.room.players) bySeat[p.seat] = players.find((x) => x.id === p.id)

{
  const r = await readRoom(b, room0.id)
  const blob = JSON.stringify(r.game_state)
  const hostCard = started.hand[0].id
  check(!blob.includes('"hands"') && !r.game_state.hands, 'public game_state has no hands')
  const { data: secrets } = await b.client.from('room_secrets').select('*')
  check(Array.isArray(secrets) && secrets.length === 0, 'room_secrets is unreadable from a client')
  const { data: myHand } = await b.client.rpc('get_my_hand', { p_room_id: room0.id })
  check(Array.isArray(myHand) && myHand.length === 13 && !myHand.some((x) => x.id === hostCard), "get_my_hand returns only your own cards")
  const outsider = await makePlayer('eve')
  const { data: none } = await outsider.client.rpc('get_my_hand', { p_room_id: room0.id })
  check(none === null, 'a non-player gets no hand')
}

// --- play a whole match ------------------------------------------------------
const hands = {}
async function myHand(p) {
  const { data } = await p.client.rpc('get_my_hand', { p_room_id: room0.id })
  return data
}
let steps = 0
let illegalTried = false
let leftDone = false
let concurrentTried = false
let lastRound = 0
while (steps++ < 1500) {
  const r = await readRoom(host, room0.id)
  const pub = r.game_state
  if (pub.phase === 'game_over') break
  if (pub.round !== lastRound) {
    lastRound = pub.round
    for (const p of players) hands[p.id] = await myHand(p)
    const total = Object.values(hands).reduce((n, h) => n + (h?.length ?? 0), 0)
    check(total === 52 - pub.trick.length - 4 * pub.tricks.reduce((x, y) => x + y, 0) || pub.phase !== 'bidding' || total === 52, `round ${pub.round}: 52 cards dealt across 4 hands (${total})`)
    const all = Object.values(hands).flat().map((x) => x.id)
    check(new Set(all).size === all.length, `round ${pub.round}: no duplicate cards`)
  }
  if (pub.phase === 'round_over') {
    await Promise.all(players.map((p) => p.call({ action: 'act', roomId: room0.id, move: { type: 'ready' } })))
    continue
  }
  const actor = bySeat[pub.turn]
  if (!actor) {
    check(false, `turn ${pub.turn} has no human — automation should have played it`)
    break
  }
  const hand = await myHand(actor)
  const rules = E.normalizeRules(r.settings)

  // Mid-match leave + rejoin (round 1, a few tricks in).
  if (!leftDone && pub.phase === 'playing' && pub.tricks.reduce((x, y) => x + y, 0) >= 3) {
    leftDone = true
    const leaver = actor
    await leaver.call({ action: 'leave', roomId: room0.id })
    const after = await readRoom(host, room0.id)
    check(after.game_state.turn !== pub.turn || after.game_state.seq > pub.seq, 'a leaver’s turn is auto-played straight away')
    check(after.players.find((p) => p.id === leaver.id)?.left === true, 'leaver is marked away, seat kept')
    const back = await leaver.call({ action: 'join', code: room0.code, name: leaver.label })
    check(back.room.players.find((p) => p.id === leaver.id)?.left === false, 'rejoining by code reclaims the seat')
    continue
  }

  if (pub.phase === 'bidding') {
    const seat = pub.turn
    if (!illegalTried) {
      illegalTried = true
      const other = bySeat[(seat + 1) % 4] ?? bySeat[(seat + 2) % 4]
      await expectError(other.call({ action: 'act', roomId: room0.id, move: { type: 'bid', bid: 3 } }), 409, 'out-of-turn bid refused by server')
    }
    const bid = E.botBid(hand, seat, pub, rules)
    await actor.call({ action: 'act', roomId: room0.id, move: { type: 'bid', bid } })
  } else if (pub.phase === 'playing') {
    const seat = pub.turn
    const illegal = hand.find((x) => !E.isPlayable(x, hand, pub.trick, pub.broken, rules.jokers, rules.spadesBreak))
    if (illegal && Math.random() < 0.3) {
      await expectError(actor.call({ action: 'act', roomId: room0.id, move: { type: 'play', card: illegal.id } }), 409, `illegal ${illegal.id} refused`)
    }
    const card = E.botCard(hand, seat, pub, rules)
    if (!concurrentTried && pub.trick.length === 0) {
      concurrentTried = true
      // Same move fired twice at once: exactly one may land.
      const results = await Promise.allSettled([
        actor.call({ action: 'act', roomId: room0.id, move: { type: 'play', card: card.id } }),
        actor.call({ action: 'act', roomId: room0.id, move: { type: 'play', card: card.id } }),
      ])
      const ok = results.filter((x) => x.status === 'fulfilled').length
      const after = await readRoom(host, room0.id)
      const plays = after.game_state.events.filter((e) => e.t === 'play' && e.card.id === card.id)
      check(plays.length === 1, `double-submitted card lands once (fulfilled ${ok})`)
    } else {
      await actor.call({ action: 'act', roomId: room0.id, move: { type: 'play', card: card.id } })
    }
  }
}

const final = await readRoom(host, room0.id)
check(final.game_state.phase === 'game_over', `match finished (phase ${final.game_state.phase}, round ${final.game_state.round})`)
check(realtimeUpdates > 10, `realtime delivered ${realtimeUpdates} room updates`)
check(final.version > 20, `version advanced to ${final.version}`)

// Stats were written by the server for all four humans.
await new Promise((r) => setTimeout(r, 300))
for (const p of players) {
  const { data: prof } = await p.client.from('profiles').select('games_played, wins, losses, elo_rating').eq('id', p.id).single()
  check(prof.games_played === 1 && prof.wins + prof.losses === 1, `${p.label}: one game recorded (${JSON.stringify(prof)})`)
  const { data: hist } = await p.client.from('match_history').select('*')
  check(hist.length === 1 && hist[0].user_id === p.id, `${p.label}: sees only their own history`)
}
{
  const { error } = await host.client.from('profiles').update({ wins: 999 }).eq('id', host.id)
  check(!!error, 'clients cannot edit their own win count')
  const { error: e2 } = await host.client.from('profiles').update({ username: `host${Date.now() % 100000}` }).eq('id', host.id)
  check(!e2, 'clients can still rename themselves')
}

// Rematch keeps the table together.
const re = await host.call({ action: 'act', roomId: room0.id, move: { type: 'rematch' } })
check(re.room.game_state.phase === 'bidding' && re.room.game_state.round === 1 && re.room.game_state.scores.A.total === 0, 'rematch deals a fresh match')

await c.client.removeChannel(channel)
console.log(`${steps} steps, ${final.game_state.round} rounds, final ${final.game_state.scores.A.total}–${final.game_state.scores.B.total}`)
if (failures) {
  console.error(`${failures} failure(s)`)
  process.exit(1)
}
console.log('online OK')
process.exit(0)
