// End-to-end check of the AI players on the LOCAL stack, with a stand-in for
// Hugging Face so nothing is spent:
//   node scripts/bots/mock-hf.mjs                                  (one shell)
//   npx supabase functions serve --env-file scripts/bots/mock.env  (another)
//   node scripts/bots/create-bots.mjs                              (once)
//   node scripts/bots/test-bots.mjs
//
// Two people (a couple) friend Jaylen, invite him, Nia comes with him, they
// play a round against them, and talk at the table. Checks seating, the
// pro brain (no Nil bids), who answers what, the AI rules filter, repeats,
// the daily cap and leaving.
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import * as E from '../../supabase/functions/_shared/engine.js'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { KEY, URL, emailFor, usernameFor, PROD } from '../test-target.mjs'

if (PROD) throw new Error('Run this against the local stack only.')
const service = execSync('npx -y supabase@latest status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?/m)[1]
const admin = createClient(URL, service, { auth: { persistSession: false } })

let failures = 0
const check = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${msg}`)
  if (!cond) failures++
}

async function makePlayer(label) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await client.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  const username = usernameFor(label)
  await client.from('profiles').insert({ id: data.user.id, email, username })
  const invoke = (fn) => async (body) => {
    const { data: res, error: err } = await client.functions.invoke(fn, { body })
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
  return { client, id: data.user.id, name: username, game: invoke('game'), bots: invoke('bots') }
}
async function status(promise) {
  try {
    await promise
    return 200
  } catch (e) {
    return e.status
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { data: botRows } = await admin.from('bot_accounts').select('id, persona, partner')
const botId = (persona) => botRows.find((b) => b.persona === persona)?.id
check(botRows.length === 8, `eight AI players exist (${botRows.length})`)
await admin.from('bot_usage').delete().neq('calls', -1)

const [me, wife, stranger] = await Promise.all(['husband', 'wife', 'stranger'].map(makePlayer))

// --- friends ---------------------------------------------------------------
const { data: req } = await me.client.from('friends').insert({ user_id: me.id, friend_id: botId('jaylen'), status: 'pending' }).select('status').single()
check(req?.status === 'accepted', 'a friend request to Jaylen is accepted straight away')
const { data: humanReq } = await me.client.from('friends').insert({ user_id: me.id, friend_id: wife.id, status: 'pending' }).select('status').single()
check(humanReq?.status === 'pending', 'a request to a person still waits for them')
check((await status(me.client.from('bot_accounts').insert({ id: me.id, persona: 'x', partner: 'y' }).then((r) => { if (r.error) throw Object.assign(new Error(r.error.message), { status: 403 }) }))) === 403, 'nobody can make their own account an AI player')

// --- the table ---------------------------------------------------------------
const { room: r0 } = await me.game({ action: 'create', name: me.name, rules: { winScore: 150, nil: true } })
await wife.game({ action: 'join', code: r0.code, name: wife.name })
await wife.game({ action: 'sit', roomId: r0.id, seat: 2 })
check((await status(stranger.game({ action: 'add_bot', roomId: r0.id, botId: botId('jaylen') }))) === 403, "someone who isn't at the table can't seat a bot")
check((await status(wife.game({ action: 'add_bot', roomId: r0.id, botId: botId('malik') }))) === 403, "you can't seat an AI player you aren't friends with")

let { room } = await me.game({ action: 'add_bot', roomId: r0.id, botId: botId('jaylen') })
const jaylen = room.players.find((p) => p.persona === 'jaylen')
check(jaylen && jaylen.isBot && jaylen.name === 'Jaylen', 'Jaylen sits down as Jaylen')
check(jaylen && jaylen.seat % 2 === 1, `…on the other team from us (seat ${jaylen?.seat})`)

const hi = await me.bots({ roomId: r0.id, trigger: 'joined', botId: jaylen.id })
check(hi.replies?.length === 1 && hi.replies[0].name === 'Jaylen' && /sat down/.test(hi.replies[0].say), `Jaylen says hi (${JSON.stringify(hi.replies?.[0]?.say)})`)
check(hi.bring === botId('nia'), 'and says he’s bringing Nia')
check(hi.replies?.[0]?.gif === 'mic drop' && hi.replies?.[0]?.emoji === '😂', 'his answer can carry an emoji and a GIF search')

// Being friends with Jaylen is enough to seat Nia.
;({ room } = await me.game({ action: 'add_bot', roomId: r0.id, botId: hi.bring }))
const nia = room.players.find((p) => p.persona === 'nia')
check(nia && nia.seat === (jaylen.seat + 2) % 4, `Nia sits across from Jaylen as his partner (seat ${nia?.seat})`)
const hi2 = await me.bots({ roomId: r0.id, trigger: 'joined', botId: nia.id })
check(hi2.replies?.[0]?.name === 'Nia' && !hi2.bring, 'Nia says hi and brings nobody')
check((await status(me.game({ action: 'add_bot', roomId: r0.id, botId: botId('jaylen') }))) === 200, 'seating Jaylen again changes nothing')
check((await status(me.game({ action: 'add_bot', roomId: r0.id, botId: botId('dre') }))) !== 200, "there's no room for a fifth player")

// --- play a round --------------------------------------------------------------
;({ room } = await me.game({ action: 'start', roomId: r0.id }))
check(room.status === 'playing' && room.players.length === 4, 'the game starts with the four of us')
const people = { [me.id]: me, [wife.id]: wife }
let guard = 0
let pub = room.game_state
const startRound = pub.round
while (guard++ < 200) {
  const fresh = (await admin.from('rooms').select('game_state, players').eq('id', r0.id).single()).data
  pub = fresh.game_state
  if (pub.phase === 'round_over' || pub.phase === 'game_over') break
  const seat = pub.turn
  const player = fresh.players.find((p) => p.seat === seat)
  const who = people[player.id]
  if (!who) {
    await sleep(50)
    continue
  }
  const { data: hand } = await who.client.rpc('get_my_hand', { p_room_id: r0.id })
  if (pub.phase === 'bidding') {
    const bid = Math.max(E.minimumBid(pub, seat, pub.rules), E.estimateBid(hand, pub.rules.jokers))
    await who.game({ action: 'act', roomId: r0.id, move: { type: 'bid', bid } })
  } else {
    const card = E.botCard(hand, seat, pub, pub.rules)
    await who.game({ action: 'act', roomId: r0.id, move: { type: 'play', card: card.id } })
  }
}
const ended = (await admin.from('rooms').select('game_state').eq('id', r0.id).single()).data.game_state
const roundBids = ended.round_result?.seats ?? []
check(ended.phase === 'round_over' || ended.phase === 'game_over', `a whole round played out (round ${startRound}, phase ${ended.phase})`)
check([jaylen.seat, nia.seat].every((s) => (roundBids[s]?.bid ?? 0) >= 1), `Jaylen and Nia bid real numbers, no Nil (${roundBids[jaylen.seat]?.bid}, ${roundBids[nia.seat]?.bid})`)

// --- talk ---------------------------------------------------------------------
await sleep(2600)
const said = await me.bots({ roomId: r0.id, trigger: 'said', text: 'nia you not ready for this' })
check(said.replies?.[0]?.name === 'Nia', `naming Nia gets Nia to answer (${said.replies?.map((x) => x.name)})`)
check(/nia you not ready/.test(said.replies?.[0]?.say ?? ''), `…about what was said (${JSON.stringify(said.replies?.[0]?.say)})`)
const again = await me.bots({ roomId: r0.id, trigger: 'said', text: 'nia??' })
check(again.replies?.length === 0, 'no answer to a second line straight after (they don’t spam)')

await sleep(2600)
const bad = await wife.bots({ roomId: r0.id, trigger: 'said', text: 'jaylen SAYBAD' })
check(bad.replies?.[0]?.name === 'Jaylen' && bad.replies[0].ai === false && BOTS.jaylen.lines.includes(bad.replies[0].say), `a line that breaks the table rules is swapped for one of his own (${JSON.stringify(bad.replies?.[0]?.say)})`)

await sleep(2600)
const m1 = await me.bots({ roomId: r0.id, trigger: 'moment', event: { type: 'round' } })
const m2 = await wife.bots({ roomId: r0.id, trigger: 'moment', event: { type: 'round' } })
check((m1.replies?.length ?? 0) + (m2.replies?.length ?? 0) <= 2 && !(m1.replies?.length && m2.replies?.length), 'two apps reporting the same moment set the bots off once')

check((await status(stranger.bots({ roomId: r0.id, trigger: 'said', text: 'hi' }))) === 403, "someone who isn't at the table can't make them talk")

await sleep(2600)
const b1 = await me.bots({ roomId: r0.id, trigger: 'moment', event: { type: 'bids' } })
const b2 = await wife.bots({ roomId: r0.id, trigger: 'moment', event: { type: 'bids' } })
const bidTalk = [...(b1.replies ?? []), ...(b2.replies ?? [])]
check(!(b1.replies?.length && b2.replies?.length), 'the bids moment sets the bots off once')
check(bidTalk.every((r) => /Everyone j/.test(r.say)), `after the bids they talk about the bids (${JSON.stringify(bidTalk[0]?.say ?? "quiet this time")})`)
if (process.env.DEBUG) console.log(JSON.stringify(bidTalk), JSON.stringify((await admin.from("bot_room_talk").select("lines").eq("room_id", r0.id).single()).data.lines.slice(-8)))

// The daily cap: past it, they talk from their own lines and no AI is called.
const { data: usage } = await admin.from('bot_usage').select('*')
check(usage?.[0]?.calls >= 4 && Number(usage?.[0]?.cost_usd) > 0, `AI calls are counted (${usage?.[0]?.calls} calls, $${usage?.[0]?.cost_usd})`)
await admin.from('bot_usage').update({ cost_usd: 99 }).neq('calls', -1)
await sleep(2600)
const capped = await me.bots({ roomId: r0.id, trigger: 'said', text: 'jaylen say something' })
check(capped.replies?.[0]?.ai === false && BOTS.jaylen.lines.includes(capped.replies[0].say), `past the daily cap Jaylen still talks, from his own lines (${JSON.stringify(capped.replies?.[0]?.say)})`)
await admin.from('bot_usage').delete().neq('calls', -1)

// --- who's who: a married couple, and "baby" ------------------------------------
await admin.from('person_facts').upsert([
  { person_id: me.id, pronouns: 'he', spouse_id: wife.id },
  { person_id: wife.id, pronouns: 'she', spouse_id: me.id },
])
await sleep(2600)
const baby = await me.bots({ roomId: r0.id, trigger: 'said', text: 'nia watch this. baby get him' })
check(/knows: his wife/.test(baby.replies?.[0]?.say ?? ''), `"baby get him" is known to be for his wife (${JSON.stringify(baby.replies?.[0]?.say)})`)

// --- the boss couple ------------------------------------------------------------
await wife.client.from('friends').insert({ user_id: wife.id, friend_id: botId('kaida'), status: 'pending' })
const { room: b0 } = await wife.game({ action: 'create', name: wife.name, rules: {} })
await wife.game({ action: 'add_bot', roomId: b0.id, botId: botId('kaida') })
const bossHi = await wife.bots({ roomId: b0.id, trigger: 'joined', botId: botId('kaida') })
check(bossHi.bring === botId('tatsu'), 'Kaida brings Tatsu')
const boss = (await wife.game({ action: 'add_bot', roomId: b0.id, botId: bossHi.bring })).room
const [kaida, tatsu] = ['kaida', 'tatsu'].map((p) => boss.players.find((x) => x.persona === p))
check(kaida && tatsu && tatsu.seat === (kaida.seat + 2) % 4 && kaida.seat % 2 !== 0, `the boss couple sits together against her (${kaida?.seat}, ${tatsu?.seat})`)
await wife.game({ action: 'start', roomId: b0.id })
const bossGame = (await admin.from('rooms').select('game_state').eq('id', b0.id).single()).data.game_state
check(bossGame.phase === 'bidding' || bossGame.phase === 'playing', `their game runs (${bossGame.phase})`)
await wife.game({ action: 'leave', roomId: b0.id })

// --- waiting room: remove, and leaving --------------------------------------------
const { room: w0 } = await me.game({ action: 'create', name: me.name, rules: {} })
await me.game({ action: 'add_bot', roomId: w0.id, botId: botId('jaylen') })
const removed = (await me.game({ action: 'remove_bot', roomId: w0.id, botId: botId('jaylen') })).room
check(removed.players.length === 1, 'a bot can be taken off the table before the game starts')
await me.game({ action: 'add_bot', roomId: w0.id, botId: botId('jaylen') })
await me.game({ action: 'leave', roomId: w0.id })
const left = (await admin.from('rooms').select('status').eq('id', w0.id).single()).data
check(left.status === 'closed', 'a table with only AI players left closes')

console.log(failures ? `\n${failures} FAILED` : '\nall passed')
process.exit(failures ? 1 : 0)
