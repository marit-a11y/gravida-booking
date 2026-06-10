/** One-shot: list the 5 most recent ai_scans + their preview state so we
 *  can diagnose why a freshly uploaded scan didn't get an in-app preview.
 *  npx ts-node --project tsconfig.json scripts/inspect-recent-scans.ts
 */
import { sql } from '@vercel/postgres'

async function main() {
  const rows = await sql`
    SELECT id, session_id, client_first_name, client_email,
           status, received_at,
           preview_status, preview_started_at, preview_completed_at,
           rodin_subscription_key, preview_glb_url, preview_error
    FROM ai_scans
    ORDER BY id DESC
    LIMIT 5
  `
  for (const r of rows.rows) {
    console.log('─'.repeat(80))
    console.log(`#${r.id}  session=${r.session_id}`)
    console.log(`  name:           ${r.client_first_name ?? '(none)'} · ${r.client_email ?? '(no email)'}`)
    console.log(`  scan status:    ${r.status}  received=${r.received_at}`)
    console.log(`  preview status: ${r.preview_status ?? '(null)'}`)
    console.log(`  preview started:${r.preview_started_at ?? '(null)'}`)
    console.log(`  preview done:   ${r.preview_completed_at ?? '(null)'}`)
    console.log(`  job key:        ${r.rodin_subscription_key ?? '(null)'}`)
    console.log(`  glb url:        ${r.preview_glb_url ?? '(null)'}`)
    console.log(`  preview error:  ${r.preview_error ?? '(null)'}`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
