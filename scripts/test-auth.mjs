import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(url, key)
const email = `mptest${Date.now()}@gmail.com`
const password = 'Test1234!'

const { data, error } = await supabase.auth.signUp({ email, password })
console.log('signUp error:', error?.message ?? null)
console.log('session present:', !!data.session)
console.log('user id:', data.user?.id)
