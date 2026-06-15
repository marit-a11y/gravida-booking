/** Run the exact same query the cron uses, see what comes back. */
import { sql } from '@vercel/postgres'
async function main() {
  const r = await sql`
    SELECT id, session_id, rodin_subscription_key, preview_status, preview_started_at
    FROM ai_scans WHERE preview_status IN ('queued', 'generating') LIMIT 25
  `
  console.log('rows:', r.rows.length)
  for (const x of r.rows) {
    console.log(`#${x.id} status=${x.preview_status} hasKey=${!!x.rodin_subscription_key}`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
