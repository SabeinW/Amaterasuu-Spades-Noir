// How the AI players' answers are read and checked (no network).
//   node scripts/bots/test-talk-parse.mjs
import { contextPrompt, memoryText, readReply, readSummary, summaryMessages, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'
import { BOTS, BOT_EMOJI } from '../../supabase/functions/_shared/bots.js'
import { EMOJI_GROUPS } from '../../src/data/taunts.js'

let failed = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${ok ? '' : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
}
const say = (id, text) => readReply(id, text).say

eq('plain JSON', readReply('dre', '{"say": "RUN ME MY BOOKS", "emoji": "🔥", "gif": "mic drop"}'), { say: 'RUN ME MY BOOKS', emoji: '🔥', gif: 'mic drop', broke: false })
eq('JSON in a code block', say('jada', '```json\n{"say": "BYE 😂", "emoji": "", "gif": ""}\n```'), 'BYE 😂')
eq('thinking before the JSON', say('nia', '<think>hmm what to say</think>{"say": "aww cute"}'), 'aww cute')
eq('broken JSON still gives the line', say('dre', '{"say: AI player, COMMISSIONER SAID SO", "emoji": "", "gif": ""}'), 'AI player, COMMISSIONER SAID SO')
eq('broken JSON with nothing readable shows nothing', say('dre', '{"emoji": "🔥", oops'), '')
eq('no JSON at all: the text itself', say('malik', 'Predictable.'), 'Predictable.')
eq('own name in front is dropped', say('dre', '{"say": "Big Dre: y\'all done"}'), "y'all done")
eq('long lines are cut', say('jaylen', `{"say": "${'no cap '.repeat(30)}"}`).length <= 110, true)
eq('swearing is dropped', readReply('keisha', '{"say": "damn y\'all bad"}').broke, true)
eq('innuendo is dropped', readReply('keisha', '{"say": "they need a safe word"}').broke, true)
eq('apes never get through', readReply('jaylen', '{"say": "playing like apes"}').broke, true)
eq('an emoji off the list is dropped', readReply('jada', '{"say": "hi", "emoji": "🍺"}').emoji, '')
eq('a GIF search for drinks is dropped', readReply('jada', '{"say": "hi", "gif": "beer pong"}').gif, '')
eq('a GIF search is kept to three words', readReply('jada', '{"gif": "crying laughing so hard right now"}').gif, 'crying laughing so')
eq('"high" is fine (high spades)', readReply('malik', '{"say": "Played my high spade. Predictable."}').broke, false)

const onTable = new Set(EMOJI_GROUPS.flatMap((g) => g.items))
eq('every bot emoji is on the table emoji list', BOT_EMOJI.filter((e) => !onTable.has(e)), [])
for (const [id, b] of Object.entries(BOTS)) {
  eq(`${b.name}'s partner is set up both ways`, BOTS[b.partner].partner, id)
  eq(`${b.name}'s own lines pass the table rules`, b.lines.filter((l) => readReply(id, JSON.stringify({ say: l })).broke), [])
  const sys = systemPrompt(id)
  eq(`${b.name}'s instructions say no Nil and AI if asked`, /never bid Nil/.test(sys) && /AI player/.test(sys), true)
}
const ctx = contextPrompt('nia', 3, { players: [{ seat: 0, name: 'Raheem' }, { seat: 1, name: 'Jaylen' }, { seat: 2, name: 'Wife' }, { seat: 3, name: 'Nia' }], game_state: {} }, [], 'test')
eq('the table is described from her seat', /partner Jaylen; the other team is Raheem and Wife/.test(ctx), true)

// Memory
const sum = readSummary('```json\n{"raheem": ["called Dre \\"lil bro\\" 😂", "said damn", "a", "b", "c", "d", "e"], "Wife": ["said they practiced all week"], "Big Dre": ["x"]}\n```', ['Raheem', 'Wife'])
eq('notes are matched to people whatever the case', Object.keys(sum), ['Raheem', 'Wife'])
eq('notes that break the table rules are dropped, five at most', sum.Raheem, ['called Dre "lil bro" 😂', 'a', 'b', 'c', 'd'])
eq('a note about an AI player is ignored', sum['Big Dre'], undefined)
eq('an answer that isn\'t JSON gives nothing', readSummary('sorry, I cannot', ['Raheem']), null)
const mem = memoryText([{ id: 'r', name: 'Raheem', side: 'opponent' }, { id: 'w', name: 'Wife', side: 'partner' }], [{ won: false, us: 380, them: 510, played_at: new Date(Date.now() - 864e5).toISOString(), people: [{ id: 'r', side: 'opponent' }] }], { r: ['called Dre "lil bro"'] })
eq('memory has the record and the last game', /Raheem \(other team\): You've played 1 game against them and won 0\. Last game yesterday you lost 380 to 510\. You remember: called Dre "lil bro"/.test(mem), true)
eq('someone new is a first time', /Wife \(your partner\): First time playing together\./.test(mem), true)
eq('no people, no memory', memoryText([], [], {}), '')
const sm = summaryMessages(['Big Dre', 'Keisha'], [{ name: 'Raheem', notes: ['old note'] }], [{ who: 'Raheem', text: 'hi' }], 'They won.')
eq('the note-taker sees old notes, the talk and how it went', /old note/.test(sm[1].content) && /Raheem: hi/.test(sm[1].content) && /They won/.test(sm[1].content), true)
eq('the note-taker is told not to make things up', /Never make anything up/.test(sm[0].content), true)

console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
