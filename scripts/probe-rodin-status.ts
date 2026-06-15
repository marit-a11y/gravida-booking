/** Probe the actual Rodin /status response shape for a stuck scan. */
import { sql } from '@vercel/postgres'

async function main() {
  const apiKey = process.env.RODIN_API_KEY ?? ''
  if (!apiKey) { console.error('no RODIN_API_KEY'); process.exit(1) }

  const r = await sql<{ id: number, rodin_subscription_key: string }>`
    SELECT id, rodin_subscription_key FROM ai_scans
    WHERE preview_status IN ('queued', 'generating')
      AND rodin_subscription_key IS NOT NULL
    ORDER BY id DESC LIMIT 1
  `
  if (!r.rows[0]) { console.log('no inflight scan with a key'); process.exit(0) }
  const subKey = r.rows[0].rodin_subscription_key
  console.log('probing scan', r.rows[0].id, 'key prefix:', subKey.slice(0, 20))

  const res = await fetch('https://hyperhuman.deemos.com/api/v2/status', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription_key: subKey }),
  })
  console.log('http', res.status)
  const text = await res.text()
  let parsed: any
  try { parsed = JSON.parse(text) } catch {}
  console.log('body:', JSON.stringify(parsed ?? text, null, 2))
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
