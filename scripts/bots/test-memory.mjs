// The AI players remember, on the LOCAL stack with the stand-in AI (same
// setup as test-bots.mjs). A couple plays a whole short game against Malik
// & Jada while talking; afterwards the bots have the game on record and
// notes on each of them, and at the next table Malik brings it up.
//   node scripts/bots/test-memory.mjs
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import * as E from '../../supabase/functions/_shared/engine.js'
import { KEY, URL, emailFor, usernameFor, PROD } from '../test-target.mjs'

if (PROD) throw new Error('Run this against the local stack only.')
const service = execSync('npx -y supabase@latest status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?/m)[1]
const admin = createClient(URL, service, { auth: { persistSession: false } })
let failures = 0
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`)
  if (!cond) failures++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function person(label) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await client.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  const username = usernameFor(label)
  await client.from('profiles').insert({ id: data.user.id, email, username })
  const call = (fn) => async (body) => {
    const { data: res, error: err } = await client.functions.invoke(fn, { body })
    if (err) throw new Error((await err.context.json().catch(() => ({}))).error ?? err.message)
    return res
  }
  return { client, id: data.user.id, name: username, game: call('game'), bots: call('bots') }
}

const me = await person('memme')
const wife = await person('memwife')
const { data: bots } = await admin.from('bot_accounts').select('id, persona')
const malik = bots.find((b) => b.persona === 'malik').id
const jada = bots.find((b) => b.persona === 'jada').id
await me.client.from('friends').insert({ user_id: me.id, friend_id: malik, status: 'pending' })

// --- a short game, with talk ------------------------------------------------
const { room } = await me.game({ action: 'create', name: me.name, rules: { winScore: 50 } })
await wife.game({ action: 'join', code: room.code, name: wife.name })
await wife.game({ action: 'sit', roomId: room.id, seat: 2 })
await me.game({ action: 'add_bot', roomId: room.id, botId: malik })
await me.game({ action: 'add_bot', roomId: room.id, botId: jada })
await me.game({ action: 'start', roomId: room.id })
await me.bots({ roomId: room.id, trigger: 'said', text: 'y’all about to get washed fr' })
await sleep(2600)
await wife.bots({ roomId: room.id, trigger: 'said', text: 'we been practicing all week 😤' })

const people = { [me.id]: me, [wife.id]: wife }
for (let guard = 0; guard < 600; guard++) {
  const { players, game_state: pub } = (await admin.from('rooms').select('players, game_state').eq('id', room.id).single()).data
  if (pub.phase === 'game_over') break
  if (pub.phase === 'round_over') {
    await me.game({ action: 'act', roomId: room.id, move: { type: 'ready' } })
    await wife.game({ action: 'act', roomId: room.id, move: { type: 'ready' } })
    continue
  }
  const who = people[players.find((p) => p.seat === pub.turn)?.id]
  if (!who) {
    await sleep(50)
    continue
  }
  const { data: hand } = await who.client.rpc('get_my_hand', { p_room_id: room.id })
  const move =
    pub.phase === 'bidding'
      ? { type: 'bid', bid: Math.max(E.minimumBid(pub, pub.turn, pub.rules), E.estimateBid(hand, pub.rules.jokers)) }
      : { type: 'play', card: E.botCard(hand, pub.turn, pub, pub.rules).id }
  await who.game({ action: 'act', roomId: room.id, move })
}
const end = (await admin.from('rooms').select('game_state').eq('id', room.id).single()).data.game_state
check(end.phase === 'game_over', `the game finished (${end.scores.A.total} to ${end.scores.B.total})`)

const { data: games } = await admin.from('bot_games').select('bot_id, won, us, them, people').eq('room_id', room.id)
check(games?.length === 2, 'Malik and Jada both have the game on record')
const mg = games?.find((g) => g.bot_id === malik)
check(mg && mg.people.some((p) => p.id === me.id && p.side === 'opponent') && mg.people.some((p) => p.id === wife.id), '…with who they played against')

await sleep(2600)
await me.bots({ roomId: room.id, trigger: 'moment', event: { type: 'won' } })
let notes = []
for (let i = 0; i < 20 && !notes.length; i++) {
  await sleep(500)
  notes = (await admin.from('bot_memories').select('bot_id, person_id, notes').in('bot_id', [malik, jada]).in('person_id', [me.id, wife.id])).data ?? []
}
check(notes.length === 4, `both bots have notes on both of us (${notes.length} rows)`)
const onMe = notes.find((n) => n.bot_id === malik && n.person_id === me.id)?.notes ?? []
check(onMe.some((n) => /washed/.test(n)), `Malik's notes on me remember what I said (${JSON.stringify(onMe)})`)
const onWife = notes.find((n) => n.bot_id === jada && n.person_id === wife.id)?.notes ?? []
check(onWife.some((n) => /practicing/.test(n)), `Jada's notes on my wife remember what she said (${JSON.stringify(onWife)})`)

// --- the next table: they bring it up ------------------------------------------
await me.game({ action: 'leave', roomId: room.id })
await wife.game({ action: 'leave', roomId: room.id })
const { room: next } = await me.game({ action: 'create', name: me.name, rules: {} })
await me.game({ action: 'add_bot', roomId: next.id, botId: malik })
const back = await me.bots({ roomId: next.id, trigger: 'said', text: 'malik you remember me?' })
const line = back.replies?.[0]?.say ?? ''
check(/mem said/.test(line), `Malik's reply had his notes on me in mind (${JSON.stringify(line)})`)
check(/knows the last game/.test(line), '…and the last game we played')
await me.game({ action: 'leave', roomId: next.id })

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
