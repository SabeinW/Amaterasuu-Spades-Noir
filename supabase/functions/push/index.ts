// The `push` edge function: sends phone/computer notifications.
//
// The app calls it right after doing something worth a ping — inviting a
// friend to a table, sending or accepting a friend request — with the id of
// the row it just wrote. The function checks that row really exists and was
// written by the caller, so nobody can push made-up messages to other
// players, and each row is pushed once at most (table push_sent).
//
//   { kind: 'key' }                      -> { publicKey } for subscribing
//   { kind: 'invite', id }               -> table_invites row you sent
//   { kind: 'friend_request', id }       -> friends row you sent
//   { kind: 'friend_accept', id }        -> friends row you accepted
//   { kind: 'test' }                     -> a ping to your own devices
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendPush } from '../_shared/webpush.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const SUBJECT = 'https://amaterasuu-spades-noir.vercel.app'
const FRESH_MS = 10 * 60 * 1000

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

let keysCache: { publicKey: string; privateKey: string } | null = null
async function vapidKeys() {
  if (keysCache) return keysCache
  const { data, error } = await admin.rpc('push_vapid_keys')
  if (error || !data) throw new Error('Push keys are not set up yet.')
  keysCache = JSON.parse(data)
  return keysCache!
}

async function nameOf(userId: string) {
  const { data } = await admin.from('profiles').select('username').eq('id', userId).maybeSingle()
  return (data?.username as string) || 'A friend'
}

const fresh = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < FRESH_MS

// Claims the right to send `key` once. False if it was already sent.
async function claim(key: string) {
  const { error } = await admin.from('push_sent').insert({ key })
  if (Math.random() < 0.02) await admin.from('push_sent').delete().lt('created_at', new Date(Date.now() - 7 * 86400_000).toISOString())
  return !error
}

async function deliver(toUser: string, message: Record<string, unknown>) {
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', toUser)
  if (!subs?.length) return { sent: 0, devices: 0 }
  const keys = await vapidKeys()
  let sent = 0
  const errors: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        const r = await sendPush(s, message, keys, { subject: SUBJECT, ttl: 30 * 60 })
        if (r.ok) {
          sent++
          await admin.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).eq('id', s.id)
        } else {
          errors.push(`${r.status} ${r.text}`)
          if (r.gone) await admin.from('push_subscriptions').delete().eq('id', s.id)
        }
      } catch (e) {
        errors.push(String((e as Error).message ?? e))
      }
    })
  )
  return { sent, devices: subs.length, errors: errors.length ? errors : undefined }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await admin.auth.getUser(token)
    const me = auth?.user?.id
    if (!me) return json({ error: 'Sign in first.' }, 401)
    const { kind, id } = await req.json().catch(() => ({}))

    if (kind === 'key') return json({ publicKey: (await vapidKeys()).publicKey })

    if (kind === 'test') {
      if (!(await claim(`test:${me}:${Math.floor(Date.now() / 20_000)}`))) return json({ sent: 0, duplicate: true })
      return json(await deliver(me, { title: 'Notifications are on', body: "You'll hear about table invites and friend requests here.", url: '/', tag: 'test' }))
    }

    if (kind === 'invite') {
      const { data: row } = await admin.from('table_invites').select('id, from_user, to_user, room_code, created_at').eq('id', id).maybeSingle()
      if (!row || row.from_user !== me || !fresh(row.created_at)) return json({ error: 'No such invite.' }, 404)
      if (!(await claim(`invite:${row.id}`))) return json({ sent: 0, duplicate: true })
      const name = await nameOf(me)
      return json(
        await deliver(row.to_user, {
          title: `${name} wants you at the table`,
          body: `Tap to join table ${row.room_code}.`,
          url: `/?join=${row.room_code}`,
          tag: `invite-${row.room_code}`,
        })
      )
    }

    if (kind === 'friend_request' || kind === 'friend_accept') {
      const { data: row } = await admin.from('friends').select('id, user_id, friend_id, status, created_at').eq('id', id).maybeSingle()
      const ok = kind === 'friend_request' ? row?.user_id === me && row?.status === 'pending' : row?.friend_id === me && row?.status === 'accepted'
      if (!row || !ok) return json({ error: 'No such request.' }, 404)
      if (!(await claim(`${kind}:${row.id}`))) return json({ sent: 0, duplicate: true })
      const name = await nameOf(me)
      const to = kind === 'friend_request' ? row.friend_id : row.user_id
      return json(
        await deliver(
          to,
          kind === 'friend_request'
            ? { title: 'New friend request', body: `${name} wants to add you as a friend.`, url: '/?open=friends', tag: `friend-${row.id}` }
            : { title: 'Friend request accepted', body: `You and ${name} are friends now. Invite them to a table!`, url: '/?open=friends', tag: `friend-${row.id}` }
        )
      )
    }

    return json({ error: 'Unknown kind.' }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: String((e as Error).message ?? e) }, 500)
  }
})
