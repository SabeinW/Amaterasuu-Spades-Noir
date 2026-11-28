// The memory on the real models: boils a game night's talk into notes, then
// has Big Dre greet the same couple at the next table with those notes and
// the last game in mind. Uses HF_TOKEN from supabase/functions/.env.
//   node scripts/bots/try-memory.mjs
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { contextPrompt, memoryText, readReply, readSummary, SUMMARY_MODEL, summaryMessages, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
const ask = async (model, messages, max_tokens = 500) => {
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens, temperature: 0.9 }),
  })
  return (await res.json()).choices?.[0]?.message?.content ?? ''
}

const talk = [
  { who: 'Big Dre', text: 'YALL DONE! Keisha comin 🔥' },
  { who: 'Raheem', text: 'yall bout to get washed tonight' },
  { who: 'Keisha', text: 'Dre, bring the mop. They think it’s laundry day.' },
  { who: 'Wife', text: 'we been practicing all week 😤' },
  { who: 'Raheem', text: 'lil bro dre really bid 6 with that 😂😂' },
  { who: 'Big Dre', text: 'THE DEAL WAS RIGGED' },
  { who: 'Wife', text: 'run me my books dre 💅' },
  { who: 'Raheem', text: 'next time bring your A game commissioner' },
]
const people = [{ name: 'Raheem', notes: [] }, { name: 'Wife', notes: [] }]
const summary = await ask(SUMMARY_MODEL, summaryMessages(['Big Dre', 'Keisha'], people, talk, 'Raheem and Wife won 510 to 380. Big Dre got set bidding 6.'))
const notes = readSummary(summary, ['Raheem', 'Wife'])
console.log('Notes the bots keep:')
for (const [n, list] of Object.entries(notes ?? {})) for (const x of list) console.log(`  ${n}: ${x}`)

const ids = { Raheem: 'r', Wife: 'w' }
const memory = memoryText(
  [
    { id: 'r', name: 'Raheem', side: 'opponent' },
    { id: 'w', name: 'Wife', side: 'opponent' },
  ],
  [{ won: false, us: 380, them: 510, played_at: new Date(Date.now() - 864e5).toISOString(), people: [{ id: 'r', side: 'opponent' }, { id: 'w', side: 'opponent' }] }],
  Object.fromEntries(Object.entries(notes ?? {}).map(([n, l]) => [ids[n], l])),
)
console.log(`\n${memory}\n`)
const room = { players: [{ seat: 0, name: 'Raheem' }, { seat: 1, name: 'Big Dre' }, { seat: 2, name: 'Wife' }, { seat: 3, name: 'Keisha' }], game_state: {} }
for (const [id, seat, partner] of [['dre', 1, 'Keisha'], ['dre', 1, 'Keisha'], ['keisha', 3, 'Big Dre'], ['keisha', 3, 'Big Dre']]) {
  const out = await ask(BOTS[id].model, [
    { role: 'system', content: systemPrompt(id) },
    { role: 'user', content: contextPrompt(id, seat, room, [], `You just sat down at the table with Raheem and Wife, next to your partner ${partner}. Say hi to them with some trash talk; if you remember them, bring up something from last time.`, memory) },
  ], 160)
  console.log(`${BOTS[id].name}: ${readReply(id, out).say}`)
}
