// The `bots` edge function: what the AI players (Big Dre & Keisha, Jaylen &
// Nia, Malik & Jada) say at the table.
//
// A player's app calls it when something worth answering happens at a table
// with AI players: someone typed in the chat or threw an emoji/GIF, an AI
// player just sat down, or a big moment in the game (spade cut, a team got
// set, the game ended). This decides whether a bot answers and which one,
// asks that bot's own model on Hugging Face for a line, checks it against the
// table rules, and hands it back. The caller's app then shows it and sends it
// to the table over realtime, GIF search included (GIPHY wants searches to
// come from the player's browser).
//
// Spending: every AI call is counted in bot_usage; once today's total reaches
// BOT_DAILY_CAP_USD (default $2) the bots keep talking with their own
// ready-made lines and no AI is called until tomorrow.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { BOTS } from '../_shared/bots.js'
import { cannedLine, contextPrompt, costOf, FALLBACK_MODEL, readReply, systemPrompt } from '../_shared/botTalk.js'

type Player = { id: string; name: string; seat: number; isBot?: boolean; persona?: string; left?: boolean }
type Line = { who: string; text: string; at: number }
type Reply = { botId: string; persona: string; seat: number; name: string; say: string; emoji: string; gif: string; delay: number; ai: boolean }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const HF_URL = Deno.env.get('HF_BASE_URL') ?? 'https://router.huggingface.co/v1'
const HF_TOKEN = Deno.env.get('HF_TOKEN') ?? ''
const DAILY_CAP = Number(Deno.env.get('BOT_DAILY_CAP_USD') ?? 2)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_GAP_MS = 2500
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 30

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const chance = (p: number) => Math.random() < p
const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

// ------------------------------------------------------------- the model ---

async function askModel(model: string, messages: unknown[]) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 9000)
  try {
    const res = await fetch(`${HF_URL}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.95,
        max_tokens: model.includes('gpt-oss') ? 320 : 160,
        ...(model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
      }),
    })
    if (!res.ok) {
      console.error('model', model, res.status, (await res.text()).slice(0, 200))
      return null
    }
    const j = await res.json()
    return { text: j.choices?.[0]?.message?.content ?? '', usage: j.usage ?? null }
  } catch (e) {
    console.error('model', model, String(e))
    return null
  } finally {
    clearTimeout(timer)
  }
}

// One line from one bot: its own model first, the fallback model if that
// fails, its ready-made lines if the AI is off or the answer broke the rules.
async function lineFrom(persona: string, seat: number, room: any, talk: Line[], happened: string, aiOn: boolean) {
  if (aiOn && HF_TOKEN) {
    const messages = [
      { role: 'system', content: systemPrompt(persona) },
      { role: 'user', content: contextPrompt(persona, seat, room, talk, happened) },
    ]
    const model = BOTS[persona as keyof typeof BOTS].model
    for (const m of model === FALLBACK_MODEL ? [model] : [model, FALLBACK_MODEL]) {
      const out = await askModel(m, messages)
      if (!out) continue
      await admin.rpc('bot_spend_add', { p_cost: costOf(m, out.usage), p_in: out.usage?.prompt_tokens ?? 0, p_out: out.usage?.completion_tokens ?? 0, p_fallback: false })
      const r = readReply(persona, out.text)
      if (r.broke) break
      if (r.say || r.emoji || r.gif) return { ...r, ai: true }
    }
  }
  await admin.rpc('bot_spend_add', { p_cost: 0, p_in: 0, p_out: 0, p_fallback: true })
  return { say: cannedLine(persona), emoji: '', gif: '', ai: false }
}

// ------------------------------------------------------------- the table ---

const nameIn = (text: string, name: string) => new RegExp(`\\b${name.split(' ').pop()!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)

// What happened, in words for the bot, and who should answer it.
function plan(body: any, room: any, me: Player, bots: Player[]) {
  const players: Player[] = room.players ?? []
  const nameOf = (s: number) => players.find((p) => p.seat === s)?.name ?? 'Someone'
  const teamName = (team: string) => {
    const seats = team === 'A' ? [0, 2] : [1, 3]
    return seats.map(nameOf).join(' and ')
  }
  const botTeam = (b: Player) => (b.seat % 2 === 0 ? 'A' : 'B')
  const trigger = String(body.trigger ?? '')

  if (trigger === 'joined') {
    const bot = bots.find((b) => b.id === body.botId)
    if (!bot) return null
    const partner = BOTS[bot.persona as keyof typeof BOTS].partner
    const partnerHere = bots.some((b) => b.persona === partner)
    const room4 = players.length >= 4
    const partnerName = BOTS[partner as keyof typeof BOTS].name
    const bring = !partnerHere && !room4 && room.status === 'waiting'
    const others = players.filter((p) => !p.isBot).map((p) => p.name).join(' and ')
    const happened = bring
      ? `You just sat down at the table with ${others}. Say hi with some trash talk, and say you're bringing your partner ${partnerName} in.`
      : `You just sat down at the table with ${others}${partnerHere ? `, next to your partner ${partnerName}` : ''}. Say hi with some trash talk.`
    return { happened, who: [bot], bring, line: null as Line | null, key: null as string | null }
  }

  if (trigger === 'said' || trigger === 'threw') {
    const text = clip(body.text, 160)
    if (!text) return null
    const line: Line = { who: me.name, text: trigger === 'said' ? text : `[threw ${text}]`, at: Date.now() }
    const happened = trigger === 'said' ? `${me.name} just said: "${text}"` : `${me.name} just threw ${text} at the table.`
    const named = bots.filter((b) => nameIn(text, b.name))
    let who: Player[] = []
    if (named.length) who = [named[0], ...(named[1] && chance(0.5) ? [named[1]] : [])]
    else if (chance(trigger === 'said' ? 0.75 : 0.45)) {
      const first = pick(bots)
      who = [first]
      const partner = bots.find((b) => b.persona === BOTS[first.persona as keyof typeof BOTS].partner)
      if (partner && chance(0.25)) who.push(partner)
    }
    return { happened, who, bring: false, line, key: null }
  }

  if (trigger === 'moment') {
    const ev = body.event ?? {}
    const pub = room.game_state ?? {}
    const type = String(ev.type ?? '')
    const round = Number(pub.round ?? 0)
    if (type === 'cut') {
      const seat = Number(ev.seat)
      if (![0, 1, 2, 3].includes(seat)) return null
      const cutter = players.find((p) => p.seat === seat)
      const bot = bots.find((b) => b.seat === seat)
      const key = `${round}:${ev.trick ?? ''}:cut`
      if (bot) return chance(0.55) ? { happened: `You just cut the trick with a spade and took the book.`, who: [bot], bring: false, line: null, key } : null
      const victim = bots.find((b) => b.seat % 2 !== seat % 2)
      if (!victim || !chance(0.35)) return null
      return { happened: `${cutter?.name ?? 'Someone'} just cut with a spade and took the book from your team.`, who: [victim], bring: false, line: null, key }
    }
    if (type === 'bids') {
      if (!chance(0.35)) return null
      const bot = pick(bots)
      return { happened: 'Everyone just finished bidding for this hand. React to the bids.', who: [bot], bring: false, line: null, key: `${round}:bids` }
    }
    if (type === 'round') {
      const r = pub.round_result
      if (!r) return null
      const key = `${pub.round}:round`
      const lines: string[] = []
      for (const team of ['A', 'B']) {
        const t = r[team]
        if (t.made === false) lines.push(`${teamName(team)} got set (bid ${t.bid}, took ${t.taken}).`)
        else if (t.made) lines.push(`${teamName(team)} made their bid (${t.taken} of ${t.bid}).`)
        if (t.penalty) lines.push(`${teamName(team)} hit the bag penalty, minus ${t.penalty}.`)
      }
      const botsSet = bots.some((b) => r[botTeam(b)].made === false)
      const humansSet = bots.some((b) => r[botTeam(b) === 'A' ? 'B' : 'A'].made === false)
      if (!botsSet && !humansSet && !chance(0.3)) return null
      if (!chance(0.85)) return null
      const bot = pick(bots)
      return { happened: `The hand just ended. ${lines.join(' ')} Scores now: ${teamName('A')} ${r.A.total}, ${teamName('B')} ${r.B.total}.`, who: [bot], bring: false, line: null, key }
    }
    if (type === 'won') {
      const winner = pub.winner
      if (!winner) return null
      const key = `${pub.round}:won`
      const [first, second] = [...bots].sort(() => Math.random() - 0.5)
      const say = (b: Player) => (botTeam(b) === winner ? 'Your team just WON the game. Celebrate and talk trash.' : 'Your team just lost the game. Be a good sport but salty and funny, ask for a rematch.')
      return { happened: `The game is over: ${teamName(winner)} won, ${pub.scores?.A?.total ?? ''} to ${pub.scores?.B?.total ?? ''}. ${say(first)}`, who: second && chance(0.6) ? [first, second] : [first], bring: false, line: null, key, eachSays: say }
    }
  }
  return null
}

async function handle(userId: string, body: any) {
  const roomId = String(body.roomId ?? '')
  if (!UUID.test(roomId)) throw new HttpError(400, 'Missing room.')
  const { data: room, error } = await admin.from('rooms').select('id, status, players, game_state').eq('id', roomId).maybeSingle()
  if (error) throw error
  if (!room) throw new HttpError(404, 'Room not found.')
  const players: Player[] = room.players ?? []
  const me = players.find((p) => p.id === userId && !p.isBot)
  if (!me) throw new HttpError(403, "You're not at this table.")
  const bots = players.filter((p) => p.isBot && p.persona && BOTS[p.persona as keyof typeof BOTS] && UUID.test(p.id))
  if (!bots.length) return { replies: [] }

  const p = plan(body, room, me, bots)
  const { data: row } = await admin.from('bot_room_talk').select('*').eq('room_id', roomId).maybeSingle()
  let talk: Line[] = row?.lines ?? []
  if (p?.line) talk = [...talk, p.line].slice(-16)
  const now = Date.now()
  const recent: number[] = (row?.recent_replies ?? []).filter((t: number) => now - t < WINDOW_MS)
  const lastAt = row?.last_reply_at ? Date.parse(row.last_reply_at) : 0

  const remember = async (extra: Record<string, unknown> = {}) => {
    await admin.from('bot_room_talk').upsert({ room_id: roomId, lines: talk, recent_replies: recent, updated_at: new Date().toISOString(), ...extra })
  }

  let answer = !!p?.who.length
  if (answer && body.trigger !== 'joined' && (now - lastAt < MIN_GAP_MS || recent.length >= MAX_PER_WINDOW)) answer = false
  if (answer && p!.key) {
    // Only one app gets to set the bots off for a game moment.
    if (!row) await admin.from('bot_room_talk').upsert({ room_id: roomId }, { onConflict: 'room_id', ignoreDuplicates: true })
    const { data: won } = await admin.from('bot_room_talk').update({ last_event: p!.key }).eq('room_id', roomId).or(`last_event.is.null,last_event.neq.${p!.key}`).select('room_id')
    if (!won?.length) answer = false
  }
  if (!answer) {
    if (p?.line) await remember()
    return { replies: [] }
  }

  const spent = Number((await admin.rpc('bot_spend_today')).data ?? 0)
  const aiOn = spent < DAILY_CAP
  const replies: Reply[] = []
  let delay = 0
  for (const bot of p!.who) {
    const happened = 'eachSays' in p! && p!.eachSays ? p!.happened.replace(/Your team just .*$/, p!.eachSays(bot)) : p!.happened
    const r = await lineFrom(bot.persona!, bot.seat, room, talk, replies.length ? `${happened}\n${replies.map((x) => `${x.name} just said: "${x.say || x.emoji || x.gif}"`).join('\n')}` : happened, aiOn)
    delay += replies.length ? 1400 + Math.random() * 1800 : 300 + Math.random() * 700
    const say = clip(r.say, 110)
    replies.push({ botId: bot.id, persona: bot.persona!, seat: bot.seat, name: bot.name, say, emoji: r.emoji, gif: r.gif, delay: Math.round(delay), ai: r.ai })
    talk = [...talk, { who: bot.name, text: say || (r.gif ? `[threw a GIF: ${r.gif}]` : `[threw ${r.emoji}]`), at: Date.now() }].slice(-16)
    recent.push(Date.now())
  }
  await remember({ last_reply_at: new Date().toISOString() })

  let bring: string | null = null
  if (p!.bring) {
    const bot = p!.who[0]
    const { data: partner } = await admin.from('bot_accounts').select('id').eq('persona', BOTS[bot.persona as keyof typeof BOTS].partner).maybeSingle()
    bring = partner?.id ?? null
  }
  return { replies, bring }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data?.user) return json({ error: 'Please sign in.' }, 401)
    const body = await req.json().catch(() => ({}))
    return json(await handle(data.user.id, body))
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: 'Something went wrong.' }, 500)
  }
})
