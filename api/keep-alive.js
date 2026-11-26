// Vercel cron (see vercel.json): free Supabase projects pause after ~7 days
// without activity, which took online play down Jul–Nov 2026. One tiny
// read a day keeps the "Spades Noir" project awake. Uses the same public
// URL/anon key the site is built with.
export default async function handler(req, res) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return res.status(500).json({ ok: false, error: 'Supabase env vars missing' })
  const r = await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() })
}
