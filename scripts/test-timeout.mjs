// A player goes silent (phone dies, tab closed — no "leave"). The table must
// keep going: once their turn deadline passes, any other player's nudge
// makes the server bid/play for them. Runs against the local stack, or
// production with TARGET=prod (see test-target.mjs).
//   node scripts/test-timeout.mjs
import { createClient } from '@supabase/supabase-js'
import * as E from '../supabase/functions/_shared/engine.js'
import { KEY, URL, emailFor, usernameFor } from './test-target.mjs'

async function makePlayer(label) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await client.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  await client.from('profiles').insert({ id: data.user.id, email, username: usernameFor(label) })
  const call = async (body) => {
    const { data: res, error: err } = await client.functions.invoke('game', { body })
    if (err) throw new Error((await err.context.json().catch(() => ({}))).error ?? err.message)
    return res
  }
  return { client, id: data.user.id, call }
}

const [a, b] = await Promise.all([makePlayer('alive'), makePlayer('silent')])
const { room } = await a.call({ action: 'create', name: 'Alive', rules: { winScore: 200 } })
await b.call({ action: 'join', code: room.code, name: 'Silent' })
const started = await a.call({ action: 'start', roomId: room.id })
const silentSeat = started.room.players.find((p) => p.id === b.id).seat
const read = async () => (await a.client.from('rooms').select('*').eq('id', room.id).single()).data

// Let the live player act whenever it's their turn; wait for the silent seat's turn.
let r = await read()
for (let i = 0; i < 40 && r.game_state.turn !== silentSeat; i++) {
  const pub = r.game_state
  const mySeat = started.room.players.find((p) => p.id === a.id).seat
  if (pub.turn === mySeat) {
    const { data: hand } = await a.client.rpc('get_my_hand', { p_room_id: room.id })
    const rules = E.normalizeRules(r.settings)
    const move = pub.phase === 'bidding' ? { type: 'bid', bid: E.botBid(hand, mySeat, pub, rules) } : { type: 'play', card: E.botCard(hand, mySeat, pub, rules).id }
    await a.call({ action: 'act', roomId: room.id, move })
  }
  r = await read()
}
const before = r.game_state
console.log(`silent seat ${silentSeat} is on turn (${before.phase}); deadline in ${Math.round((before.deadline - Date.now()) / 1000)}s`)

const early = await a.call({ action: 'act', roomId: room.id, move: { type: 'nudge' } })
if (early.room.game_state.seq !== before.seq) throw new Error('nudge before the deadline must not move')
console.log('early nudge ignored ✓ — waiting for the deadline…')
await new Promise((res) => setTimeout(res, before.deadline - Date.now() + 800))
const after = (await a.call({ action: 'act', roomId: room.id, move: { type: 'nudge' } })).room.game_state
const auto = after.events.find((e) => e.seq > before.seq && e.seat === silentSeat && e.auto)
if (!auto) throw new Error('the silent seat was not auto-played after its deadline')
console.log(`server auto-${auto.t === 'bid' ? `bid ${auto.bid}` : `played ${auto.card.id}`} for the silent player ✓ (turn moved on to seat ${after.turn})`)
console.log('timeout OK')
process.exit(0)
