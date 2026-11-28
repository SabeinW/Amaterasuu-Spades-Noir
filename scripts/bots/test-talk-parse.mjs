// How the AI players' answers are read and checked (no network).
//   node scripts/bots/test-talk-parse.mjs
import { readReply, systemPrompt, contextPrompt } from '../../supabase/functions/_shared/botTalk.js'
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

console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
