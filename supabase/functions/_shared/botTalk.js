// How an AI player's line is asked for and checked, shared by the `bots`
// edge function and the local tests. Nothing here calls the network.
import { BOTS, BOT_EMOJI, NOT_AT_THIS_TABLE } from './bots.js'

// The same family blocklist the GIF search uses (src/lib/giphy.js).
const GIPHY_BLOCKED = /\b(monkeys?|apes?|gorillas?|chimps?|chimpanzees?|baboons?|orangutans?|pigs?|piggy|hogs?|swine|pork|bacon|ham|beers?|wine|vodka|whiske?y|tequila|drunk|alcohol|booze|cocktails?|sexy|twerk\w*|bikini|thirst\w*|weed|stoned|vap(e|ing)|cigarettes?|guns?)\b/i

// Most a model costs per million tokens on any Hugging Face provider (Nov
// 2026), so the daily cap is counted on the safe side.
export const PRICE = {
  'meta-llama/Llama-3.3-70B-Instruct': [0.72, 2.25],
  'deepseek-ai/DeepSeek-V3.2': [0.9, 1.6],
  'google/gemma-3-27b-it': [0.1, 0.45],
  'Qwen/Qwen3-235B-A22B-Instruct-2507': [0.15, 0.8],
  'openai/gpt-oss-120b': [0.35, 0.95],
  'moonshotai/Kimi-K2.5': [0.6, 3],
}
export const FALLBACK_MODEL = 'meta-llama/Llama-3.3-70B-Instruct'

export function costOf(model, usage) {
  const [i, o] = PRICE[model] ?? [1, 3]
  return ((usage?.prompt_tokens ?? 1500) * i + (usage?.completion_tokens ?? 120) * o) / 1e6
}

export function systemPrompt(id) {
  const b = BOTS[id]
  const partner = BOTS[b.partner]
  return [
    `You are ${b.name}, a ${b.age}-year-old Black ${b.gender}, playing Spades online with friends in the app Amaterasuu Noir Spades. Your partner, sitting across from you, is ${partner.name}; you two always play as a team.`,
    `Personality: ${b.vibe}`,
    `How you type: ${b.style}`,
    'You are a strong player and a funny trash talker. Keep it playful, never truly mean.',
    'Table rules, never break them: no swearing at all, not even mild words, and no innuendo. Nothing about drinking, drugs, smoking, betting money, flirting or dating, religion or politics. Never joke about anyone\'s looks, race, weight or family. Never say what cards you hold or what you will play. You never bid Nil; with a weak hand you bid what the board needs. If someone sincerely asks whether you are a bot, an AI or a real person, say you are an AI player, still in character.',
    'Answer with ONLY a JSON object like {"say": "", "emoji": "", "gif": ""}:',
    '- "say": what you type in the table chat, under 90 characters, or "" to stay quiet.',
    `- "emoji": one emoji to throw at the table from this list, or "": ${BOT_EMOJI.join(' ')}`,
    '- "gif": 1 to 3 words to search for a funny reaction GIF (like "mic drop" or "crying laughing"), or "". Only now and then.',
    'Most of the time just "say", sometimes with an emoji. Type like a real person texting, never like an assistant. Never put your own name in front.',
  ].join('\n')
}

const TEAM_WORD = { A: [0, 2], B: [1, 3] }

// Everything the bot is told about the table: who's who, the score, this
// hand's bids and books, the recent talk, and what just happened.
export function contextPrompt(id, seat, room, talk, happened) {
  const pub = room.game_state ?? {}
  const players = room.players ?? []
  const name = (s) => players.find((p) => p.seat === s)?.name ?? `Seat ${s + 1}`
  const partner = (seat + 2) % 4
  const opps = [(seat + 1) % 4, (seat + 3) % 4]
  const usTeam = seat % 2 === 0 ? 'A' : 'B'
  const themTeam = usTeam === 'A' ? 'B' : 'A'
  const out = [`Who's at the table: your partner ${name(partner)}; the other team is ${name(opps[0])} and ${name(opps[1])}.`]
  if (pub.scores) {
    out.push(`Score: your team ${pub.scores[usTeam].total} (${pub.scores[usTeam].bags} bags), their team ${pub.scores[themTeam].total} (${pub.scores[themTeam].bags} bags). Game to ${pub.rules?.winScore ?? 500}. Round ${pub.round ?? 1}.`)
  }
  if (pub.bids?.some((b) => b !== null && b !== undefined)) {
    const row = (s) => `${s === seat ? 'you' : name(s)} bid ${pub.bids[s] ?? '?'}, has ${pub.tricks?.[s] ?? 0} books`
    out.push(`This hand: ${[seat, partner, ...opps].map(row).join('; ')}.`)
    const need = (team) => TEAM_WORD[team].reduce((n, s) => n + (pub.bids[s] || 0), 0)
    const took = (team) => TEAM_WORD[team].reduce((n, s) => n + (pub.tricks?.[s] ?? 0), 0)
    out.push(`Your team needs ${need(usTeam)} and has ${took(usTeam)}; they need ${need(themTeam)} and have ${took(themTeam)}.`)
  }
  if (talk?.length) out.push(`Recent table talk:\n${talk.slice(-12).map((l) => `${l.who}: ${l.text}`).join('\n')}`)
  out.push(`What just happened: ${happened}`)
  out.push(`Reply as ${BOTS[id].name}, as JSON only.`)
  return out.join('\n\n')
}

// The model's answer → { say, emoji, gif }, cleaned for the table. Anything
// that breaks the table rules is dropped; an empty result means stay quiet.
export function readReply(id, text) {
  const b = BOTS[id]
  let raw = String(text ?? '')
  raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const m = raw.match(/\{[\s\S]*\}/)
  let obj = null
  if (m) {
    try {
      obj = JSON.parse(m[0])
    } catch {
      obj = null
    }
  }
  if (!obj) {
    // Not quite JSON: pull the line out if it's there, and never show the
    // table raw brackets and quotes.
    const say = raw.match(/"say"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? raw.match(/"say\s*:\s*([^"]+)"/)?.[1]
    const first = raw.split('\n').find((l) => l.trim()) ?? ''
    obj = { say: say ?? (/[{}]|"\w+"\s*:/.test(first) ? '' : first) }
  }
  let say = String(obj.say ?? '').replace(/\s+/g, ' ').trim()
  say = say.replace(/^["'“”]+|["'“”]+$/g, '').trim()
  for (const n of [b.name, b.name.split(' ').pop()]) {
    const prefix = new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*`, 'i')
    say = say.replace(prefix, '')
  }
  if (say.length > 110) say = `${say.slice(0, 107).replace(/\s+\S*$/, '')}…`
  const blocked = (s) => NOT_AT_THIS_TABLE.test(s) || GIPHY_BLOCKED.test(s)
  const broke = blocked(say)
  if (broke) say = ''
  let emoji = String(obj.emoji ?? '').trim()
  if (!BOT_EMOJI.includes(emoji)) emoji = ''
  let gif = String(obj.gif ?? '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
  if (gif.length > 30 || blocked(gif)) gif = ''
  return { say, emoji, gif, broke }
}

// A ready-made line for when the AI is off (daily cap reached, Hugging
// Face down) or its answer broke the table rules.
export function cannedLine(id, rng = Math.random) {
  const lines = BOTS[id].lines
  return lines[Math.floor(rng() * lines.length)]
}
