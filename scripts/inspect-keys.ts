import { sql } from '@vercel/postgres'
async function main() {
  const r = await sql`
    SELECT id, session_id, client_first_name, status, preview_status, preview_started_at,
      SUBSTRING(rodin_subscription_key, 1, 25) AS key_prefix,
      LENGTH(rodin_subscription_key) AS key_len,
      preview_error
    FROM ai_scans ORDER BY id DESC LIMIT 10
  `
  for (const x of r.rows) console.log(x)
  process.exit(0)
}
main()
