// Dagelijkse ping (Vercel Cron) zodat het gratis Supabase-project niet gepauzeerd wordt.
// Doet één kleine databasequery; met de publieke sleutel en RLS komt er niets terug.
export async function GET() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return Response.json({ ok: false, error: 'Supabase-variabelen ontbreken' }, { status: 500 })
  const res = await fetch(`${url}/rest/v1/settings?select=user_id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  return Response.json({ ok: res.ok, status: res.status, at: new Date().toISOString() }, { status: res.ok ? 200 : 502 })
}
