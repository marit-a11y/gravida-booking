/**
 * Adds the two tables that back the Atelier AI scan flow (smartphone app,
 * 4 photos + optional detail close-ups, AI sculpted by digital sculptors).
 *
 * Run once after deploy:   npx ts-node --project tsconfig.json scripts/setup-ai-scans-db.ts
 *
 * Idempotent: safe to re-run, only creates if missing.
 */
import { sql } from '@vercel/postgres'

async function main() {
  console.log('Adding ai_scans + ai_scan_photos tables...')

  // ai_scans: one row per submitted capture session from the app.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_scans (
      id                  SERIAL PRIMARY KEY,
      session_id          UUID NOT NULL UNIQUE,
      client_first_name   VARCHAR(100),
      client_last_name    VARCHAR(100),
      client_email        VARCHAR(200),
      client_phone        VARCHAR(30),
      pregnancy_weeks     INTEGER,
      consent_eu_storage  BOOLEAN NOT NULL DEFAULT TRUE,
      app_version         VARCHAR(40),
      device_label        VARCHAR(120),
      status              VARCHAR(20) NOT NULL DEFAULT 'in_progress',
      customer_number     VARCHAR(8),
      booking_id          INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
      diy_rental_id       INTEGER REFERENCES diy_rentals(id) ON DELETE SET NULL,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      received_at         TIMESTAMPTZ,
      reviewed_at         TIMESTAMPTZ,
      reviewed_by         INTEGER REFERENCES dashboard_users(id) ON DELETE SET NULL,
      sent_email_at       TIMESTAMPTZ,
      atelier_notes       TEXT
    )
  `
  console.log('ok ai_scans')

  // Status convention:
  //   in_progress  — upload-init called, photos still uploading
  //   received     — complete() called, ready for Laila to review
  //   reviewing    — Laila opened it in the admin
  //   approved     — Laila approved + email sent to client
  //   rejected     — Laila rejected, asked the client to redo

  await sql`
    CREATE INDEX IF NOT EXISTS ai_scans_status_idx       ON ai_scans (status)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS ai_scans_created_idx      ON ai_scans (created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS ai_scans_session_idx      ON ai_scans (session_id)
  `

  // ai_scan_photos: one row per uploaded photo, points at Vercel Blob URL.
  await sql`
    CREATE TABLE IF NOT EXISTS ai_scan_photos (
      id            SERIAL PRIMARY KEY,
      scan_id       INTEGER NOT NULL REFERENCES ai_scans(id) ON DELETE CASCADE,
      angle         VARCHAR(16) NOT NULL,   -- front | right | back | left | detail
      order_idx     INTEGER NOT NULL DEFAULT 0,
      blob_url      TEXT NOT NULL,
      blob_pathname TEXT NOT NULL,
      mime          VARCHAR(40) NOT NULL,
      bytes         INTEGER NOT NULL,
      width         INTEGER,
      height        INTEGER,
      note          TEXT,                    -- only meaningful for angle='detail'
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  console.log('ok ai_scan_photos')

  await sql`
    CREATE INDEX IF NOT EXISTS ai_scan_photos_scan_idx ON ai_scan_photos (scan_id)
  `

  console.log('\nDone.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
