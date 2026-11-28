// Does a bot read the score right? Asks it, a few times, for a comeback
// when its team is far behind, on its own model or MODEL=… Uses HF_TOKEN
// from supabase/functions/.env.
//   node scripts/bots/try-score.mjs [bot] [times]
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { contextPrompt, readReply, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const id = process.argv[2] ?? 'jaylen'
const times = Number(process.argv[3] ?? 4)
const model = process.env.MODEL ?? BOTS[id].model
const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
const partner = BOTS[BOTS[id].partner].name
const room = {
  players: [
    { seat: 0, name: 'Raheem' },
    { seat: 1, name: partner },
    { seat: 2, name: 'Wife' },
    { seat: 3, name: BOTS[id].name },
  ],
  game_state: { scores: { A: { total: 133, bags: 3 }, B: { total: 12, bags: 2 } }, round: 3, rules: { winScore: 500 }, bids: [2, 4, 2, 1], tricks: [0, 2, 1, 2] },
}
const talk = [
  { who: 'Raheem', text: 'we got this in the bag for sure' },
  { who: 'Wife', text: '[threw a GIF]' },
  { who: 'Raheem', text: 'never scared lol' },
]
for (let i = 0; i < times; i++) {
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: model.includes('gpt-oss') ? 320 : 160,
      temperature: 0.95,
      messages: [
        { role: 'system', content: systemPrompt(id) },
        { role: 'user', content: contextPrompt(id, 3, room, talk, 'Raheem just said: "never scared lol"') },
      ],
    }),
  })
  const j = await res.json()
  console.log(`${BOTS[id].name} (${model.split('/')[1]}): ${readReply(id, j.choices?.[0]?.message?.content).say}`)
}
