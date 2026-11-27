// In-app table invites between friends (table `table_invites`, see the
// 20261127 migration). Inviting writes a row; the friend's app hears it over
// realtime and offers to join. Invites older than 30 minutes are ignored.
import { supabase, supabaseEnabled } from './supabase'
import { notify } from './push'

const FRESH_MS = 30 * 60 * 1000

export async function sendInvite(fromUserId, toUserId, roomCode) {
  if (!supabaseEnabled) return
  const { data, error } = await supabase.from('table_invites').insert({ from_user: fromUserId, to_user: toUserId, room_code: roomCode }).select('id').single()
  if (error) throw new Error(error.message.includes('row-level security') ? 'You can only invite friends.' : error.message)
  notify('invite', data?.id)
}

export async function dismissInvite(id) {
  if (!supabaseEnabled || !id) return
  await supabase.from('table_invites').delete().eq('id', id)
}

// Invites sent to me in the last 30 minutes, newest first, with the sender's
// name and avatar.
export async function pendingInvites(userId) {
  if (!supabaseEnabled || !userId) return []
  const since = new Date(Date.now() - FRESH_MS).toISOString()
  const { data } = await supabase
    .from('table_invites')
    .select('id, from_user, room_code, created_at')
    .eq('to_user', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (!data?.length) return []
  const { data: senders } = await supabase.from('profiles').select('id, username, avatar_url').in('id', [...new Set(data.map((d) => d.from_user))])
  const byId = Object.fromEntries((senders ?? []).map((p) => [p.id, p]))
  return data.map((d) => ({ ...d, from: byId[d.from_user] ?? { username: 'A friend' } }))
}

// Calls onInvite() whenever a new invite arrives for me. Returns an unsubscribe.
export function subscribeInvites(userId, onInvite) {
  if (!supabaseEnabled || !userId) return () => {}
  const channel = supabase
    .channel(`invites-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'table_invites', filter: `to_user=eq.${userId}` }, () => onInvite())
    .subscribe()
  return () => supabase.removeChannel(channel)
}
