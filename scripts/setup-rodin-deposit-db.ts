/**
 * Adds the columns that back the Rodin auto-preview + €35 verrekenbare aanbetaling.
 *
 * Run once after deploy: npx ts-node --project tsconfig.json scripts/setup-rodin-deposit-db.ts
 *
 * Idempotent: alle ADD COLUMN statements zijn IF NOT EXISTS.
 */
import { sql } from '@vercel/postgres'

async function main() {
  console.log('Adding Rodin preview + Mollie deposit columns to ai_scans...')

  // Rodin auto-preview state. Een sessie loopt door deze stappen:
  //   queued     - upload-complete net gedaan, generation wacht op cron-pickup
  //   generating - Rodin werkt, subscription_key is gezet, cron pollt elke 60s
  //   ready      - mesh ligt klaar in Blob, glb_url + stl_url zijn populated
  //   failed     - Rodin gaf een error, preview_error bevat de body
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS rodin_subscription_key TEXT`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS preview_status         VARCHAR(16)`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS preview_glb_url        TEXT`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS preview_stl_url        TEXT`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS preview_started_at     TIMESTAMPTZ`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS preview_completed_at   TIMESTAMPTZ`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS preview_error          TEXT`
  console.log('ok preview columns')

  // €35 verrekenbare aanbetaling via Mollie. De coupon_code is een
  // WooCommerce-coupon (kortingscode €35 op studiogravida.com) die we
  // automatisch aanmaken na succesvol Mollie webhook.
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS deposit_amount_cents      INTEGER`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS deposit_mollie_payment_id VARCHAR(64)`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS deposit_paid_at           TIMESTAMPTZ`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS deposit_coupon_code       VARCHAR(40)`
  console.log('ok deposit columns')

  // Index voor de cron-poll job: we willen snel alle scans vinden die nog
  // 'queued' of 'generating' zijn, zonder full-scan over alle history.
  await sql`
    CREATE INDEX IF NOT EXISTS ai_scans_preview_status_idx
      ON ai_scans (preview_status)
      WHERE preview_status IN ('queued', 'generating')
  `
  console.log('ok preview_status partial index')

  console.log('\nDone.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
