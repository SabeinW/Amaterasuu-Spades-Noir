// A stand-in for Hugging Face's chat API, for testing the `bots` function on
// the local stack without spending anything. Each answer names the bot and
// what it was asked about, so tests can check the right bot answered. A
// message containing SAYBAD gets an answer that breaks the table rules.
//   node scripts/bots/mock-hf.mjs [host] [port]   (default 172.17.0.1 8799,
//   the address the functions container sees this machine at)
import http from 'node:http'

const host = process.argv[2] ?? '172.17.0.1'
const port = Number(process.argv[3] ?? 8799)
let calls = 0

http
  .createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      if (req.url === '/calls') {
        res.end(JSON.stringify({ calls }))
        return
      }
      if (!req.url.endsWith('/chat/completions')) {
        res.statusCode = 404
        res.end('{}')
        return
      }
      calls++
      const j = JSON.parse(body || '{}')
      const system = j.messages?.[0]?.content ?? ''
      const user = j.messages?.[1]?.content ?? ''
      const who = system.match(/^You are ([^,]+),/)?.[1] ?? 'Someone'
      const what = user.match(/What just happened: ([^\n]*)/)?.[1] ?? ''
      const bad = /SAYBAD/.test(user)
      const reply = bad
        ? { say: 'damn that was a bad play', emoji: '', gif: '' }
        : { say: `${who} heard: ${what.slice(0, 50)}`, emoji: '😂', gif: /GIF|joined|sat down/i.test(what) ? 'mic drop' : '' }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ model: j.model, choices: [{ message: { content: JSON.stringify(reply) } }], usage: { prompt_tokens: 700, completion_tokens: 30 } }))
    })
  })
  .listen(port, host, () => console.log(`mock Hugging Face on http://${host}:${port}`))
