// Do the bots get who's who right? A married couple (he and she) plays
// Jaylen & Nia; the husband says "baby get him" to his wife. Prints each
// bot's answer a few times. Uses HF_TOKEN from supabase/functions/.env.
//   node scripts/bots/try-who.mjs [times]
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { aboutText, contextPrompt, readReply, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const times = Number(process.argv[2] ?? 3)
const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
const room = {
  players: [
    { seat: 0, name: 'Sabe.Of.Spades' },
    { seat: 1, name: 'Nia' },
    { seat: 2, name: 'TSwizzle' },
    { seat: 3, name: 'Jaylen' },
  ],
  game_state: { scores: { A: { total: 133, bags: 3 }, B: { total: 12, bags: 2 } }, round: 3, rules: { winScore: 500 }, bids: [2, 4, 2, 1], tricks: [0, 2, 1, 2] },
}
const about = aboutText(
  [
    { id: 's', name: 'Sabe.Of.Spades' },
    { id: 't', name: 'TSwizzle' },
  ],
  { s: { pronouns: 'he', spouse_id: 't' }, t: { pronouns: 'she', spouse_id: 's' } },
)
const talk = [
  { who: 'TSwizzle', text: '[threw 😤]' },
  { who: 'Jaylen', text: 'nah TSwizzle you cooked this hand' },
  { who: 'Sabe.Of.Spades', text: 'baby get him' },
]
for (const [id, seat] of [
  ['nia', 1],
  ['jaylen', 3],
]) {
  for (let i = 0; i < times; i++) {
    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: BOTS[id].model,
        max_tokens: 160,
        temperature: 0.95,
        messages: [
          { role: 'system', content: systemPrompt(id) },
          { role: 'user', content: contextPrompt(id, seat, room, talk, 'Sabe.Of.Spades just said: "baby get him" (Sabe.Of.Spades is talking to his wife TSwizzle, not to you.)', '', about) },
        ],
      }),
    })
    const j = await res.json()
    console.log(`${BOTS[id].name}: ${readReply(id, j.choices?.[0]?.message?.content).say}`)
  }
}
