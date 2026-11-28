// Asks each AI player for one line about the same table moment, on its real
// Hugging Face model, and prints what came back, how long it took and what
// it cost. Uses HF_TOKEN from supabase/functions/.env (never printed).
//   node scripts/bots/try-models.mjs [bot …]
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { contextPrompt, costOf, readReply, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
if (!token) throw new Error('No HF_TOKEN in supabase/functions/.env')
const room = {
  players: [
    { seat: 0, name: 'Raheem' },
    { seat: 1, name: 'BOT' },
    { seat: 2, name: 'Wife' },
    { seat: 3, name: 'PARTNER' },
  ],
  game_state: { round: 3, scores: { A: { total: 182, bags: 3 }, B: { total: 140, bags: 6 } }, rules: { winScore: 500 }, bids: [4, 3, 3, 2], tricks: [3, 1, 2, 1] },
}
const talk = [
  { who: 'Raheem', text: 'y’all about to get set again lol' },
  { who: 'Wife', text: 'they bid 5 together and got 2 😂' },
]
let total = 0
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BOTS)
for (const id of ids) {
  const b = BOTS[id]
  const r = structuredClone(room)
  r.players[1].name = b.name
  r.players[3].name = BOTS[b.partner].name
  const messages = [
    { role: 'system', content: systemPrompt(id) },
    { role: 'user', content: contextPrompt(id, 1, r, talk, 'Raheem just said "y’all about to get set again lol" to your team.') },
  ]
  const t = Date.now()
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.MODEL ?? b.model, messages, max_tokens: 400, temperature: 0.9, ...(b.model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}) }),
  })
  const ms = Date.now() - t
  const j = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.log(`${b.name} (${b.model}) → HTTP ${res.status} ${JSON.stringify(j).slice(0, 200)}`)
    continue
  }
  const content = j.choices?.[0]?.message?.content
  const cost = costOf(b.model, j.usage)
  total += cost
  console.log(`${b.name} (${process.env.MODEL ?? b.model}, ${res.headers.get('x-inference-provider') ?? '?'}) ${ms} ms, ${j.usage?.prompt_tokens}+${j.usage?.completion_tokens} tokens, ≤$${cost.toFixed(5)}`)
  console.log('   raw:', JSON.stringify(content).slice(0, 220))
  console.log('   →', JSON.stringify(readReply(id, content)))
}
console.log(`total ≤ $${total.toFixed(4)}`)
