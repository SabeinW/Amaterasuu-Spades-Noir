// What the bots say once everyone has bid: the same hand, several tries,
// each with its random angle, to hear the variety. Uses HF_TOKEN from
// supabase/functions/.env.
//   node scripts/bots/try-bids.mjs [times] [bot …]
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { aboutText, bidsMoment, contextPrompt, readReply, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const times = Number(process.argv[2] ?? 4)
const ids = process.argv.slice(3).length ? process.argv.slice(3) : ['tatsu', 'kaida']
const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
const about = aboutText(
  [
    { id: 's', name: 'Sabe' },
    { id: 't', name: 'Swizz' },
  ],
  { s: { pronouns: 'he', spouse_id: 't' }, t: { pronouns: 'she', spouse_id: 's' } },
)
for (const id of ids) {
  const partner = BOTS[BOTS[id].partner].name
  const players = [
    { seat: 0, name: 'Sabe' },
    { seat: 1, name: partner },
    { seat: 2, name: 'Swizz' },
    { seat: 3, name: BOTS[id].name },
  ]
  const pub = {
    round: 4,
    rules: { winScore: 500 },
    scores: { A: { total: 154, bags: 4 }, B: { total: 146, bags: 6 } },
    bids: [3, 4, 2, 3],
    tricks: [0, 0, 0, 0],
    events: [{ t: 'round', round: 3, result: { A: { made: true }, B: { made: false }, seats: [{ bid: 2, taken: 4 }, { bid: 3, taken: 1 }, { bid: 3, taken: 3 }, { bid: 2, taken: 2 }] } }],
  }
  for (let i = 0; i < times; i++) {
    const m = bidsMoment(pub, players)
    const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: BOTS[id].model,
        max_tokens: 160,
        temperature: 0.95,
        messages: [
          { role: 'system', content: systemPrompt(id) },
          { role: 'user', content: contextPrompt(id, 3, { players, game_state: pub }, [], m.happened, '', about) },
        ],
      }),
    })
    const j = await res.json()
    console.log(`${BOTS[id].name} [${m.angle.split(':')[0].slice(0, 38)}]: ${readReply(id, j.choices?.[0]?.message?.content).say}`)
  }
}
