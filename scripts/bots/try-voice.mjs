// Do the bots talk in the first person and back their partner? Malik is on
// zero books this hand, Jada has three, and the other team is calling Malik
// out. Prints a few answers from each. Uses HF_TOKEN from
// supabase/functions/.env.
//   node scripts/bots/try-voice.mjs [times]
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { contextPrompt, readReply, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const times = Number(process.argv[2] ?? 3)
const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
const room = {
  players: [
    { seat: 0, name: 'Sabe' },
    { seat: 1, name: 'Malik' },
    { seat: 2, name: 'Swizz' },
    { seat: 3, name: 'Jada' },
  ],
  game_state: { scores: { A: { total: 289, bags: 9 }, B: { total: 207, bags: 7 } }, round: 7, rules: { winScore: 500 }, bids: [4, 2, 3, 3], tricks: [4, 0, 2, 3] },
}
const talk = [
  { who: 'Jada', text: 'Malik you at ZERO while I’m out here grinding solo??' },
  { who: 'Malik', text: 'Zero books again. Predictable.' },
  { who: 'Sabe', text: 'malik you sleep? 😂' },
]
for (const [id, seat] of [
  ['malik', 1],
  ['jada', 3],
]) {
  for (let i = 0; i < times; i++) {
    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: BOTS[id].model,
        max_tokens: BOTS[id].model.includes('gpt-oss') ? 320 : 160,
        temperature: 0.95,
        ...(BOTS[id].model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
        messages: [
          { role: 'system', content: systemPrompt(id) },
          { role: 'user', content: contextPrompt(id, seat, room, talk, 'Sabe just said: "malik you sleep? 😂"') },
        ],
      }),
    })
    const j = await res.json()
    console.log(`${BOTS[id].name}: ${readReply(id, j.choices?.[0]?.message?.content).say}`)
  }
}
