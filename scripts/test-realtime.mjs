import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
  email: 'mptest1783420099677@gmail.com',
  password: 'Test1234!',
})
if (signInErr) throw signInErr
const hostId = signInData.user.id

const { data: room, error: createErr } = await supabase
  .from('rooms')
  .insert({
    host_id: hostId,
    host_name: 'mptest',
    code: 'RT' + Date.now().toString().slice(-4),
    status: 'waiting',
    player_count: 1,
    players: [{ id: hostId, name: 'mptest', seat: 0 }],
    settings: {},
    ready_players: [],
    game_state: {},
  })
  .select()
  .single()
if (createErr) throw createErr
console.log('created room', room.id, room.code)

let received = false
const channel = supabase
  .channel(`room-db:${room.id}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (payload) => {
    console.log('REALTIME EVENT RECEIVED:', JSON.stringify(payload.new.players))
    received = true
  })
  .subscribe((status) => console.log('channel status:', status))

await new Promise((r) => setTimeout(r, 2000))

console.log('updating room...')
const { error: updateErr } = await supabase
  .from('rooms')
  .update({ players: [...room.players, { id: 'guest-test', name: 'guest', seat: 1 }], player_count: 2 })
  .eq('id', room.id)
if (updateErr) console.log('update error:', updateErr.message)

await new Promise((r) => setTimeout(r, 4000))
console.log('received event:', received)

await supabase.from('rooms').delete().eq('id', room.id).then(() => {}, () => {})
process.exit(0)
