import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseEnabled = Boolean(url && anonKey)

// Opened from a "reset your password" email? Read it before the client
// below takes the sign-in details out of the address.
export const openedFromResetLink = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash + window.location.search)

export const supabase = supabaseEnabled
  ? createClient(url, anonKey, { realtime: { params: { eventsPerSecond: 10 } } })
  : null
