// Does a bot keep straight who said what? Sabe teases Big Dre, Big Dre
// yells "WHERE MY BOOKS AT", then Sabe cuts and Keisha reacts. She must not
// pin Dre's line on Sabe. Uses HF_TOKEN from supabase/functions/.env.
//   node scripts/bots/try-attrib.mjs [times]
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { aboutText, contextPrompt, readReply, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const times = Number(process.argv[2] ?? 6)
const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
const room = {
  players: [
    { seat: 0, name: 'Sabe.Of.Spades' },
    { seat: 1, name: 'Big Dre' },
    { seat: 2, name: 'TSwizzle' },
    { seat: 3, name: 'Keisha' },
  ],
  game_state: { scores: { A: { total: 180, bags: 4 }, B: { total: 261, bags: 3 } }, round: 7, rules: { winScore: 500 }, bids: [2, 7, 2, 1], tricks: [0, 4, 3, 1] },
}
const about = aboutText(
  [
    { id: 's', name: 'Sabe.Of.Spades' },
    { id: 't', name: 'TSwizzle' },
  ],
  { s: { pronouns: 'he', spouse_id: 't' }, t: { pronouns: 'she', spouse_id: 's' } },
)
const talk = [
  { who: 'Big Dre', text: 'YEAH KEISHA GOT YOU' },
  { who: 'Sabe.Of.Spades', text: 'not Dre with all the Aces lmao' },
  { who: 'Big Dre', text: 'WHERE MY BOOKS AT' },
]
let wrong = 0
for (let i = 0; i < times; i++) {
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: BOTS.keisha.model,
      max_tokens: 160,
      temperature: 0.95,
      messages: [
        { role: 'system', content: systemPrompt('keisha') },
        { role: 'user', content: contextPrompt('keisha', 3, room, talk, 'TSwizzle just cut with a spade and took the book from your team.', '', about) },
      ],
    }),
  })
  const j = await res.json()
  const r = readReply('keisha', j.choices?.[0]?.message?.content)
  const blames = /sabe[^.?!]*where (my|my|his) books/i.test(r.say) || /sabe[^.?!]*talking (bout|about) .?where/i.test(r.say)
  if (blames) wrong++
  console.log(`Keisha: ${r.say}${r.foreign ? '  [not English]' : ''}${blames ? '  [WRONG PERSON]' : ''}`)
}
console.log(`${wrong} of ${times} pinned Dre's line on Sabe`)
