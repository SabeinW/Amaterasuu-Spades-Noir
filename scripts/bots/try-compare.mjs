// One bot, the same table moments, two models side by side, to hear which
// one talks better. Uses HF_TOKEN from supabase/functions/.env.
//   node scripts/bots/try-compare.mjs keisha moonshotai/Kimi-K2.5 [times]
import fs from 'node:fs'
import { BOTS } from '../../supabase/functions/_shared/bots.js'
import { aboutText, contextPrompt, readReply, systemPrompt } from '../../supabase/functions/_shared/botTalk.js'

const id = process.argv[2] ?? 'keisha'
const other = process.argv[3] ?? 'moonshotai/Kimi-K2.5'
const times = Number(process.argv[4] ?? 2)
const token = fs.readFileSync(new URL('../../supabase/functions/.env', import.meta.url), 'utf8').match(/HF_TOKEN=(\S+)/)?.[1]
const me = BOTS[id].name
const partner = BOTS[BOTS[id].partner].name
const players = [
  { seat: 0, name: 'Sabe' },
  { seat: 1, name: partner },
  { seat: 2, name: 'Swizz' },
  { seat: 3, name: me },
]
const about = aboutText(
  [
    { id: 's', name: 'Sabe' },
    { id: 't', name: 'Swizz' },
  ],
  { s: { pronouns: 'he', spouse_id: 't' }, t: { pronouns: 'she', spouse_id: 's' } },
)
const moments = [
  {
    label: 'losing big, they talk',
    state: { scores: { A: { total: 247, bags: 7 }, B: { total: 146, bags: 6 } }, round: 6, rules: { winScore: 500 }, bids: [4, 3, 3, 3], tricks: [2, 0, 1, 2] },
    talk: [{ who: 'Sabe', text: 'yall need a coach fr 😂' }],
    happened: 'Sabe just said: "yall need a coach fr 😂"',
  },
  {
    label: `they roast ${partner}`,
    state: { scores: { A: { total: 120, bags: 2 }, B: { total: 150, bags: 3 } }, round: 4, rules: { winScore: 500 }, bids: [3, 4, 2, 3], tricks: [2, 0, 1, 3] },
    talk: [{ who: 'Swizz', text: `${partner.toLowerCase()} got zero books lol` }],
    happened: `Swizz just said: "${partner.toLowerCase()} got zero books lol"`,
  },
  {
    label: 'we just set them',
    state: { scores: { A: { total: 90, bags: 1 }, B: { total: 180, bags: 2 } }, round: 5, rules: { winScore: 500 }, bids: [4, 3, 3, 3], tricks: [2, 4, 1, 6] },
    talk: [{ who: 'Sabe', text: 'we got this baby' }],
    happened: 'The hand just ended. Sabe and Swizz got set (bid 7, took 3). Your team made 6 of 6.',
  },
]
const ask = async (model, m) => {
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: model.includes('gpt-oss') ? 320 : 160,
      temperature: 0.95,
      messages: [
        { role: 'system', content: systemPrompt(id) },
        { role: 'user', content: contextPrompt(id, 3, { players, game_state: m.state }, m.talk, m.happened, '', about) },
      ],
    }),
  })
  const t = Date.now()
  const j = await res.json()
  return { say: readReply(id, j.choices?.[0]?.message?.content).say || '(nothing)', ms: Date.now() - t }
}
for (const m of moments) {
  console.log(`\n— ${m.label}`)
  for (const model of [BOTS[id].model, other]) {
    for (let i = 0; i < times; i++) {
      const t = Date.now()
      const { say } = await ask(model, m)
      console.log(`  ${model.split('/')[1].padEnd(16).slice(0, 16)} ${((Date.now() - t) / 1000).toFixed(1)}s  ${me}: ${say}`)
    }
  }
}
