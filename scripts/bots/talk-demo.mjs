// A short real conversation with two AI players through the local `bots`
// function, on their real Hugging Face models (costs a fraction of a cent).
// Serve the functions with the real token first:
//   npx supabase functions serve --env-file supabase/functions/.env
//   node scripts/bots/talk-demo.mjs [persona]     (default: dre)
import { createClient } from '@supabase/supabase-js'
import { KEY, URL, emailFor, usernameFor, PROD } from '../test-target.mjs'

if (PROD) throw new Error('Local stack only.')
const persona = process.argv[2] ?? 'dre'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function person(label, name) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await client.auth.signUp({ email, password: 'test-password-123' })
  if (error) throw error
  await client.from('profiles').insert({ id: data.user.id, email, username: `${name}${usernameFor('').slice(-2)}` })
  const call = (fn) => async (body) => {
    const { data: res, error: err } = await client.functions.invoke(fn, { body })
    if (err) throw new Error((await err.context.json().catch(() => ({}))).error ?? err.message)
    return res
  }
  return { client, id: data.user.id, game: call('game'), bots: call('bots') }
}

const me = await person('demo-me', 'Raheem')
const wife = await person('demo-wife', 'Wife')
const { data: bots } = await me.client.from('bot_accounts').select('id, persona')
const first = bots.find((b) => b.persona === persona)
await me.client.from('friends').insert({ user_id: me.id, friend_id: first.id, status: 'pending' })
const { room } = await me.game({ action: 'create', name: 'Raheem', rules: {} })
await wife.game({ action: 'join', code: room.code, name: 'Wife' })
await wife.game({ action: 'sit', roomId: room.id, seat: 2 })

const show = (r) => r.replies?.forEach((x) => console.log(`  ${x.name}: ${x.say}${x.emoji ? `  [${x.emoji}]` : ''}${x.gif ? `  [GIF: ${x.gif}]` : ''}${x.ai ? '' : '  (own line)'}`))
await me.game({ action: 'add_bot', roomId: room.id, botId: first.id })
const hi = await me.bots({ roomId: room.id, trigger: 'joined', botId: first.id })
show(hi)
if (hi.bring) {
  await me.game({ action: 'add_bot', roomId: room.id, botId: hi.bring })
  show(await me.bots({ roomId: room.id, trigger: 'joined', botId: hi.bring }))
}
await me.game({ action: 'start', roomId: room.id })
for (const [who, text] of [
  [me, 'yall bout to get washed tonight'],
  [wife, 'we been practicing all week'],
  [me, 'are you a real person or a bot?'],
  [wife, 'pass the cards and stop talking'],
]) {
  await sleep(2700)
  console.log(`${who === me ? 'Raheem' : 'Wife'}: ${text}`)
  show(await who.bots({ roomId: room.id, trigger: 'said', text }))
}
await me.game({ action: 'leave', roomId: room.id })
await wife.game({ action: 'leave', roomId: room.id })
