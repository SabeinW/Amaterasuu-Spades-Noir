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
  'google/gemma-4-31B-it': [0.75, 1],
  'Qwen/Qwen3-235B-A22B-Instruct-2507': [0.15, 0.8],
  'openai/gpt-oss-120b': [0.35, 0.95],
  'moonshotai/Kimi-K2.5': [0.6, 3],
  'NousResearch/Hermes-4-405B': [1, 3],
  'google/gemma-4-26B-A4B-it': [0.15, 0.6],
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
    'Those phrases only show your voice. Make up a fresh line every time: never reuse them word for word, and never repeat anything already said at the table. Be specific about what just happened (who said what, the bids, the books, the score) and call people by name.',
    'You are a strong player and a funny trash talker. Keep it playful, never truly mean.',
    `Always talk in the first person (I, me, my, we, us). Never say your own name ("${b.name}") or talk about yourself like you're someone else.`,
    `${partner.name} is your partner and on your side: hype ${partner.name} up and have their back. A light joke at ${partner.name} now and then is fine, but aim your trash talk at the other team.`,
    'Table rules, never break them: no swearing at all, not even mild words, and no innuendo. Nothing about drinking, drugs, smoking, betting money, flirting or dating, religion or politics. Never joke about anyone\'s looks, race, weight or family. Never say what cards you hold or what you will play. Never guess whether someone is a man or a woman: go by what you are told, otherwise call them by name. You never bid Nil; with a weak hand you bid what the board needs. If someone sincerely asks whether you are a bot, an AI or a real person, say you are an AI player, still in character.',
    'Answer with ONLY a JSON object like {"say": "", "emoji": "", "gif": ""}:',
    '- "say": what you type in the table chat, under 100 characters (one or two short sentences), or "" to stay quiet.',
    `- "emoji": one emoji to throw at the table from this list, or "": ${BOT_EMOJI.join(' ')}`,
    '- "gif": 1 to 3 words to search for a funny reaction GIF (like "mic drop" or "crying laughing"), or "". Only now and then.',
    'Write in English only.',
    'Most of the time just "say", sometimes with an emoji. Type like a real person texting, never like an assistant: vary it, sometimes only a couple of words, sometimes a full line. Never put your own name in front.',
  ].join('\n')
}

const TEAM_WORD = { A: [0, 2], B: [1, 3] }

// Everything the bot is told about the table: who's who, the score, this
// hand's bids and books, the recent talk, and what just happened.
export function contextPrompt(id, seat, room, talk, happened, memory = '', about = '') {
  const pub = room.game_state ?? {}
  const players = room.players ?? []
  const name = (s) => players.find((p) => p.seat === s)?.name ?? `Seat ${s + 1}`
  const partner = (seat + 2) % 4
  const opps = [(seat + 1) % 4, (seat + 3) % 4]
  const usTeam = seat % 2 === 0 ? 'A' : 'B'
  const themTeam = usTeam === 'A' ? 'B' : 'A'
  const out = [`Who's at the table: you are ${BOTS[id].name}; your partner (your teammate) is ${name(partner)}; the other team, the ones to trash talk, is ${name(opps[0])} and ${name(opps[1])}.`]
  if (about) out.push(about)
  if (pub.scores) {
    // Spelled out, winner first, so no model gets it backwards.
    const us = pub.scores[usTeam].total
    const them = pub.scores[themTeam].total
    const diff = us - them
    const lead =
      diff > 0
        ? `Your team is WINNING: you're ahead of ${name(opps[0])} and ${name(opps[1])} by ${diff}. They're the ones behind.`
        : diff < 0
          ? `Your team is LOSING: ${name(opps[0])} and ${name(opps[1])} are AHEAD of you by ${-diff}. You're the ones behind, so never say they're behind or losing.`
          : 'The game is tied.'
    out.push(
      `Score: you and ${name(partner)} have ${us} points (${pub.scores[usTeam].bags} bags); ${name(opps[0])} and ${name(opps[1])} have ${them} points (${pub.scores[themTeam].bags} bags). ${lead} First to ${pub.rules?.winScore ?? 500} wins. Round ${pub.round ?? 1}. Ten bags costs a team 100 points.`,
    )
  }
  if (pub.bids?.some((b) => b !== null && b !== undefined)) {
    const row = (s) => (s === seat ? `you bid ${pub.bids[s] ?? '?'} and have ${pub.tricks?.[s] ?? 0} books` : `${name(s)} bid ${pub.bids[s] ?? '?'} and has ${pub.tricks?.[s] ?? 0} books`)
    out.push(`This hand: ${[seat, partner, ...opps].map(row).join('; ')}.`)
    const need = (team) => TEAM_WORD[team].reduce((n, s) => n + (pub.bids[s] || 0), 0)
    const took = (team) => TEAM_WORD[team].reduce((n, s) => n + (pub.tricks?.[s] ?? 0), 0)
    out.push(`Your team needs ${need(usTeam)} and has ${took(usTeam)}; they need ${need(themTeam)} and have ${took(themTeam)}.`)
  }
  if (memory) out.push(memory)
  if (talk?.length) {
    // Every line says whose side it came from, so nobody gets quoted wrong
    // (Keisha pinned Big Dre's "WHERE MY BOOKS AT" on Sabe).
    const side = (who) => (who === BOTS[id].name ? 'you' : who === name(partner) ? 'your partner' : [name(opps[0]), name(opps[1])].includes(who) ? 'other team' : '')
    const lines = talk.slice(-12).map((l) => `${l.who}${side(l.who) ? ` (${side(l.who)})` : ''}: ${l.text}`)
    out.push(`Recent table talk, oldest first. Check the name on a line before you quote it or answer it. Never start a line the way one of yours started:\n${lines.join('\n')}`)
  }
  out.push(`What just happened: ${happened}`)
  out.push(`Reply as ${BOTS[id].name}, as JSON only.`)
  return out.join('\n\n')
}

// A long line ends at a full sentence where it can (then a comma, then a
// word) instead of mid-thought: the Kimi bots run long.
export const LINE_MAX = 140
export function trimLine(say) {
  if (say.length <= LINE_MAX) return say
  const head = say.slice(0, LINE_MAX)
  const sentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '), head.lastIndexOf('?? '))
  if (sentence >= 40) return head.slice(0, sentence + 1).trim()
  const end = head.search(/[.!?][^.!?]*$/)
  if (end >= 40 && /[.!?]/.test(head[end])) return head.slice(0, end + 1).trim()
  const comma = head.lastIndexOf(', ')
  if (comma >= 60) return head.slice(0, comma).trim()
  return `${head.slice(0, LINE_MAX - 1).replace(/\s+\S*$/, '')}…`
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
  say = trimLine(say)
  const blocked = (s) => NOT_AT_THIS_TABLE.test(s) || GIPHY_BLOCKED.test(s)
  // Kimi now and then slips into Chinese mid-line; the table reads English.
  const foreign = FOREIGN.test(say)
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
  return { say, emoji, gif, broke, foreign }
}

// Letters from scripts the table doesn't read: Chinese, Japanese, Korean,
// Cyrillic, Arabic, Hebrew, Thai, Devanagari.
const FOREIGN = /[\u0400-\u04ff\u0590-\u06ff\u0900-\u097f\u0e00-\u0e7f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/

// A ready-made line for when the AI is off (daily cap reached, Hugging
// Face down) or its answer broke the table rules.
export function cannedLine(id, rng = Math.random) {
  const lines = BOTS[id].lines
  return lines[Math.floor(rng() * lines.length)]
}

// ---------------------------------------------------------------- memory ---

const ago = (iso, now = Date.now()) => {
  const days = Math.floor((now - Date.parse(iso)) / 86400000)
  return days <= 0 ? 'earlier today' : days === 1 ? 'yesterday' : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : 'a while back'
}

// What a bot remembers about the people at the table: its record against
// (or with) each of them, the last game, and its notes on them.
//   people: [{ id, name, side: 'partner' | 'opponent' }] relative to the bot
//   games:  this bot's bot_games rows, newest first
//   notes:  { [personId]: ['note', …] }
export function memoryText(people, games, notes, now = Date.now()) {
  const lines = []
  for (const p of people) {
    const together = (games ?? []).filter((g) => (g.people ?? []).some((x) => x.id === p.id))
    const parts = []
    if (!together.length) parts.push('first time playing together')
    else {
      const vs = together.filter((g) => g.people.find((x) => x.id === p.id)?.side === 'opponent')
      const w = vs.filter((g) => g.won).length
      if (vs.length) parts.push(`you've played ${vs.length} game${vs.length > 1 ? 's' : ''} against them and won ${w}`)
      const last = together[0]
      parts.push(`last game ${ago(last.played_at, now)} you ${last.won ? 'won' : 'lost'} ${last.us} to ${last.them}`)
    }
    const n = notes?.[p.id] ?? []
    if (n.length) parts.push(`you remember: ${n.join('; ')}`)
    const said = parts.map((x) => x[0].toUpperCase() + x.slice(1)).join('. ')
    lines.push(`- ${p.name} (${p.side === 'partner' ? 'your partner' : 'other team'}): ${said}.`)
  }
  if (!lines.length) return ''
  return `What you remember about the people here. Use it like a friend who remembers: now and then bring up one thing that fits (an old win or loss, something they said or promised). Never list it:\n${lines.join('\n')}`
}

export const SUMMARY_MODEL = 'Qwen/Qwen3-235B-A22B-Instruct-2507'
const MAX_NOTES = 5

// Asks for updated notes on each person from what was just said at the
// table plus what the bots already remembered.
//   people: [{ name, notes: [] }]   lines: [{ who, text }]   bots: names
export function summaryMessages(bots, people, lines, outcome = '', about = '') {
  const old = people.map((p) => `- ${p.name}: ${p.notes.length ? p.notes.join('; ') : '(nothing yet)'}`).join('\n')
  return [
    {
      role: 'system',
      content: [
        `You keep the memory of the AI card players ${bots.join(' and ')} in a family Spades app.`,
        'From the table talk and what they already remember, keep short notes about each PERSON listed (never about the AI players) that are worth bringing up next time:',
        'how they talk (their actual slang, catchphrases and emojis), trash talk or jokes they made, promises or challenges (like saying they\'d win next time), and anything notable that happened to them in the game.',
        'Only write what is really in the talk or the old notes, with their real words in quotes where you can. Never make anything up, never flatter, and never put one person\'s words under someone else\'s name: check who said each line.',
        'Write each note as a short sentence about what they did, so whoever reads it knows it was them, like: called Dre "lil bro" for bidding 6 😂 / said they practiced all week / promised to beat Dre next time.',
        `Merge with the old notes and drop stale ones. At most ${MAX_NOTES} notes per person, fewer is fine, each under 90 characters. Family-clean: no swearing, nothing about looks, race or family.`,
        'Answer with ONLY a JSON object: {"<person name>": ["note", ...], ...}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `People: ${people.map((p) => p.name).join(', ')}${about ? `\n${about}` : ''}\n\nWhat they already remember:\n${old}\n\nTable talk:\n${lines.map((l) => `${l.who}: ${l.text}`).join('\n')}${outcome ? `\n\nHow it went: ${outcome}` : ''}`,
    },
  ]
}

// The answer → { [person name]: ['note', …] }, cleaned for the table.
export function readSummary(text, names) {
  const raw = String(text ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '')
  const m = raw.match(/\{[\s\S]*\}/)
  let obj = null
  try {
    obj = m ? JSON.parse(m[0]) : null
  } catch {
    obj = null
  }
  if (!obj || typeof obj !== 'object') return null
  const out = {}
  for (const name of names) {
    const key = Object.keys(obj).find((k) => k.trim().toLowerCase() === name.trim().toLowerCase())
    const list = Array.isArray(obj[key]) ? obj[key] : []
    out[name] = list
      .map((n) => String(n ?? '').replace(/\s+/g, ' ').trim())
      .filter((n) => n && !NOT_AT_THIS_TABLE.test(n) && !GIPHY_BLOCKED.test(n))
      .map((n) => (n.length > 100 ? `${n.slice(0, 97).replace(/\s+\S*$/, '')}…` : n))
      .slice(0, MAX_NOTES)
  }
  return out
}

// The first two words of a line, for spotting a bot saying the same thing
// the same way again.
const words = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
export const opening = (text) => words(text).slice(0, 2).join(' ')

// Mostly the same words as another line, small words aside: Jada said
// "Malik didn't leash me, he signed up to WIN…" twice, and Tatsu ran the
// same joke three times ("throwing GIFs like that's gonna save you").
const SMALL = new Set('a an the to of and or but so is are was be been am im i you your youre yall we us our me my he she they them it its in on at for with this that thats just like gonna got get not no yes do dont does did all up out what how who when why if then than too still really'.split(' '))
const content = (text) => new Set(words(text).filter((w) => !SMALL.has(w)))
function sameWords(a, b) {
  const x = content(a)
  const y = content(b)
  if (x.size < 2 || y.size < 2) return false
  let both = 0
  for (const w of x) if (y.has(w)) both++
  return both >= 2 && both / Math.min(x.size, y.size) >= 0.55
}

// Words that come up all the time at a Spades table and people's names:
// never a pet word (a bot saying "TSwizzle" or "spades" twice is normal).
const TABLE_WORDS = new Set('spade spades heart hearts diamond diamonds club clubs book books bid bids bag bags trick tricks joker jokers deuce deuces board round rounds hand hands partner score points game cards card nil blind set sets cut cuts trump trumps ace aces king kings queen queens jack jacks little big'.split(' '))

// Starts like one of this bot's last few lines?
//   names: everyone at the table (their names are never pet words)
export function samey(id, say, talk, names = []) {
  const o = opening(say)
  const mine = (talk ?? []).filter((l) => l.who === BOTS[id].name).slice(-5)
  if (mine.some((l) => (o.split(' ').length >= 2 && opening(l.text) === o) || sameWords(l.text, say) || words(l.text).join(' ') === words(say).join(' '))) return true
  // A pet word: a longer word they've already leaned on twice lately
  // (Malik's "Predictable." three times in a row).
  const skip = new Set([...TABLE_WORDS, ...[...names, ...(talk ?? []).map((l) => l.who), ...Object.values(BOTS).map((b) => b.name)].flatMap((n) => words(n))])
  const pet = (w) => w.length >= 6 && !skip.has(w)
  const counts = {}
  for (const l of mine) for (const w of new Set(words(l.text))) if (pet(w)) counts[w] = (counts[w] ?? 0) + 1
  return words(say).some((w) => pet(w) && (counts[w] ?? 0) >= 2)
}

// ------------------------------------------------------------ who's who ---

const WHO = { he: 'a man (he/him)', she: 'a woman (she/her)', they: 'they/them' }
const SPOUSE = { he: 'husband', she: 'wife' }

// Pronouns and marriages for the people at the table, from person_facts:
//   people: [{ id, name }]   facts: { [id]: { pronouns, spouse_id } }
export function aboutText(people, facts) {
  const lines = []
  for (const p of people) if (WHO[facts?.[p.id]?.pronouns]) lines.push(`${p.name} is ${WHO[facts[p.id].pronouns]}.`)
  const paired = new Set()
  for (const p of people) {
    const sid = facts?.[p.id]?.spouse_id
    if (!sid || paired.has(p.id)) continue
    const s = people.find((x) => x.id === sid)
    if (!s) {
      lines.push(`${p.name} is married; ${{ he: 'his', she: 'her' }[facts[p.id].pronouns] ?? 'their'} spouse isn't at this table.`)
      continue
    }
    paired.add(p.id)
    paired.add(s.id)
    const role = (x) => SPOUSE[facts?.[x.id]?.pronouns] ?? 'spouse'
    lines.push(`${p.name} and ${s.name} are married (${s.name} is ${p.name}'s ${role(s)}, ${p.name} is ${s.name}'s ${role(p)}). When either of them says baby, bae, babe or my love, they mean each other, never you.`)
  }
  const unknown = people.filter((p) => !WHO[facts?.[p.id]?.pronouns]).map((p) => p.name)
  if (unknown.length) lines.push(`You don't know whether ${unknown.join(' or ')} ${unknown.length > 1 ? 'are' : 'is'} a he or a she: call them by name, never guess.`)
  return lines.length ? `Who's who: ${lines.join(' ')}` : ''
}

// ------------------------------------------------------- after the bids ---

// What a bot is told once everyone has bid: the bids, the team totals, how
// many of the 13 books are spoken for, last hand's bids and books (from the
// public play-by-play), and one angle picked at random so the talk changes
// from hand to hand.
//   pub: the table's public state   players: [{ seat, name }]
export function bidsMoment(pub, players, rng = Math.random) {
  const bids = pub.bids ?? []
  if (bids.length !== 4 || bids.some((b) => b === null || b === undefined)) return null
  const name = (s) => players.find((p) => p.seat === s)?.name ?? `Seat ${s + 1}`
  const team = (t) => (t === 'A' ? `${name(0)} and ${name(2)}` : `${name(1)} and ${name(3)}`)
  const say = (b) => (b === 0 ? 'Nil' : String(b))
  const total = bids.reduce((a, b) => a + b, 0)
  const left = 13 - total
  const facts = [
    `Everyone just bid for hand ${pub.round ?? 1}: ${[0, 1, 2, 3].map((s) => `${name(s)} ${say(bids[s])}`).join(', ')}.`,
    `${team('A')} bid ${bids[0] + bids[2]} together; ${team('B')} bid ${bids[1] + bids[3]}. That's ${total} of 13 books bid${
      left > 0 ? `, so ${left} extra book${left > 1 ? 's' : ''} will end up as somebody's bags` : left < 0 ? ', more books than there are, so somebody is getting set' : ', every book spoken for'
    }.`,
  ]
  const last = [...(pub.events ?? [])].reverse().find((e) => e.t === 'round' && e.round === (pub.round ?? 1) - 1)
  const seats = last?.result?.seats
  if (seats?.length === 4) {
    const set = ['A', 'B'].filter((t) => last.result[t]?.made === false).map((t) => ` ${team(t)} got set.`)
    facts.push(`Last hand: ${[0, 1, 2, 3].map((s) => `${name(s)} bid ${say(seats[s].bid)} and took ${seats[s].taken}`).join('; ')}.${set.join('')}`)
  }
  const angles = [
    "Roast the other team's bid: too scared, too greedy, or it doesn't add up.",
    "Hype your own team's bid and promise the books.",
    'Call out the one bid that stands out the most.',
    'Talk about the books left over: bags coming, or a set coming.',
    'Predict how this hand is going to go.',
    ...(seats?.length === 4 ? ['Compare somebody\'s bid now with what they bid and took last hand.', 'Bring up how last hand went and what it means for this one.'] : []),
  ]
  const angle = angles[Math.floor(rng() * angles.length)]
  return { happened: `${facts.join(' ')} React to the bids. This time: ${angle}`, angle }
}
