// Friends, table invites, XP/levels and leaderboards against the database.
// Runs on the LOCAL stack by default; TARGET=prod uses the live project with
// clearly marked qa- accounts (see test-target.mjs). Never edit profiles
// directly here: since the server-authoritative migration only the server
// may change stats.
//   node scripts/test-social-logic.mjs
import { createClient } from '@supabase/supabase-js'
import { KEY, URL, emailFor, usernameFor } from './test-target.mjs'

let failed = 0
const check = (label, ok, extra = '') => {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${extra ? ` (${extra})` : ''}`)
}

async function makeUser(label) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } })
  const email = emailFor(label)
  const { data, error } = await client.auth.signUp({ email, password: 'Test1234!' })
  if (error) throw error
  const username = usernameFor(label)
  const { error: pErr } = await client.from('profiles').insert({ id: data.user.id, email, username })
  if (pErr) throw pErr
  return { client, id: data.user.id, username }
}

console.log(`target: ${URL}`)
const A = await makeUser('alice')
const B = await makeUser('bob')
const C = await makeUser('carol')

// ── friends ──
const { error: reqErr } = await A.client.from('friends').insert({ user_id: A.id, friend_id: B.id, status: 'pending' })
check('A sends B a friend request', !reqErr, reqErr?.message)
const { data: incoming } = await B.client.from('friends').select('*').eq('friend_id', B.id).eq('status', 'pending')
check('B sees the request', incoming?.length === 1)
const { error: forged } = await C.client.from('friends').update({ status: 'accepted' }).eq('id', incoming[0].id).select()
const { data: stillPending } = await B.client.from('friends').select('status').eq('id', incoming[0].id).single()
check("C can't accept a request that isn't theirs", stillPending.status === 'pending', forged?.message)
const { error: accErr } = await B.client.from('friends').update({ status: 'accepted' }).eq('id', incoming[0].id)
check('B accepts', !accErr, accErr?.message)
const { data: aFriends } = await A.client.from('friends').select('*').or(`user_id.eq.${A.id},friend_id.eq.${A.id}`).eq('status', 'accepted')
check('A sees the friendship', aFriends?.length === 1)

// ── table invites ──
let heard = false
const channel = B.client
  .channel(`invites-${B.id}`)
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_invites', filter: `to_user=eq.${B.id}` }, () => (heard = true))
await new Promise((resolve) => channel.subscribe((s) => s === 'SUBSCRIBED' && resolve()))
// the server registers a new subscription a moment after SUBSCRIBED
await new Promise((r) => setTimeout(r, 2000))
const { error: invErr } = await A.client.from('table_invites').insert({ from_user: A.id, to_user: B.id, room_code: '4821' })
check('A invites friend B to a table', !invErr, invErr?.message)
for (let i = 0; i < 40 && !heard; i++) await new Promise((r) => setTimeout(r, 200))
check('B hears the invite live', heard)
const { data: bInvites } = await B.client.from('table_invites').select('*').eq('to_user', B.id)
check('B can read the invite', bInvites?.length === 1 && bInvites[0].room_code === '4821')
const { error: strangerErr } = await C.client.from('table_invites').insert({ from_user: C.id, to_user: B.id, room_code: '4821' })
check("C (not a friend) can't invite B", !!strangerErr)
const { data: cSees } = await C.client.from('table_invites').select('*')
check("C can't see other people's invites", (cSees ?? []).length === 0)
const { error: delErr } = await B.client.from('table_invites').delete().eq('id', bInvites[0].id)
check('B can dismiss the invite', !delErr, delErr?.message)
await B.client.removeChannel(channel)

// ── XP ──
const xpOf = async (u) => (await u.client.from('profiles').select('xp').eq('id', u.id).single()).data?.xp
check('new players start at 0 XP', (await xpOf(A)) === 0)
const { data: after, error: prErr } = await A.client.rpc('record_practice_result', { p_won: true, p_your: 520, p_opp: 300, p_rounds: 8 })
check('a practice win records', !prErr, prErr?.message)
check('a practice win gives half XP: (100 + 8×5) × 0.5 = 70', after?.xp === 70, `got ${after?.xp}`)
const { error: achErr } = await A.client.from('achievements').insert({ user_id: A.id, badge_name: 'sharpshooter', description: 'Sharpshooter' })
check('earning an achievement records', !achErr, achErr?.message)
check('an achievement adds 25 XP', (await xpOf(A)) === 95, `got ${await xpOf(A)}`)
await A.client.from('profiles').update({ xp: 999999 }).eq('id', A.id)
check("players can't set their own XP", (await xpOf(A)) === 95)

// ── leaderboards ──
const { data: byXp, error: lbErr } = await A.client.from('profiles').select('id, xp').in('id', [A.id, B.id, C.id]).order('xp', { ascending: false })
check('level board orders by XP', !lbErr && byXp[0].id === A.id, lbErr?.message)
const { count: ahead } = await B.client.from('profiles').select('id', { count: 'exact', head: true }).in('id', [A.id, B.id]).gt('xp', 0)
check("B's place among friends is 2nd", (ahead ?? 0) + 1 === 2)

console.log(`\n${failed ? `${failed} FAILED` : 'all passed'}`)
process.exit(failed ? 1 : 0)
