// Creates the six AI players' accounts (once; running it again changes
// nothing that's already there). Each is an ordinary account with a profile
// plus a row in bot_accounts saying who it is and who its partner is. The
// password is random and thrown away: nobody ever signs in as them.
//   local:  node scripts/bots/create-bots.mjs
//   live:   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/bots/create-bots.mjs
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import { BOTS } from '../../supabase/functions/_shared/bots.js'

function localEnv() {
  const out = execSync('npx -y supabase@latest status -o env', { encoding: 'utf8' })
  const get = (k) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?`, 'm'))?.[1]
  return { url: get('API_URL'), key: get('SERVICE_ROLE_KEY') }
}
const env = process.env.SUPABASE_SERVICE_ROLE_KEY ? { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY } : localEnv()
if (!env.url || !env.key) throw new Error('Missing the Supabase URL or service key.')
const admin = createClient(env.url, env.key, { auth: { persistSession: false, autoRefreshToken: false } })

// Until their own portraits are painted they wear one of the table's
// ink-and-gold medallions, none of them one a plain table bot wears.
const AVATAR = { dre: 'lion', keisha: 'owl', jaylen: 'kestrel', nia: 'deer', malik: 'dragon', jada: 'sparrow' }

const { data: existing, error: listError } = await admin.from('bot_accounts').select('id, persona')
if (listError) throw listError
for (const [persona, b] of Object.entries(BOTS)) {
  if (existing.some((r) => r.persona === persona)) {
    console.log(`${b.name}: already here`)
    continue
  }
  const email = `${persona}@ai.amaterasuu.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: crypto.randomBytes(32).toString('base64url'),
    email_confirm: true,
    user_metadata: { ai_player: persona },
  })
  if (error) throw new Error(`${b.name}: ${error.message}`)
  const id = data.user.id
  const avatar = JSON.stringify({ kind: 'art', src: `/art/avatars/${AVATAR[persona]}.webp`, border: null })
  const { error: pErr } = await admin.from('profiles').upsert({ id, email, username: b.name, avatar_url: avatar })
  if (pErr) throw new Error(`${b.name} profile: ${pErr.message}`)
  const { error: bErr } = await admin.from('bot_accounts').insert({ id, persona, partner: b.partner, favorite_deck: b.deck })
  if (bErr) throw new Error(`${b.name} bot row: ${bErr.message}`)
  console.log(`${b.name}: created`)
}
