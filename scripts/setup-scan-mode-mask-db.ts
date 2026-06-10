/**
 * Adds scan_mode + masked_image_url to ai_scans.
 *
 *   scan_mode         - 'standing' (subject turns) or 'seated' (photographer
 *                       walks around). Drives the in-app instructions and
 *                       the angle text.
 *   masked_image_url  - The rembg-cleaned PNG (transparent background) of
 *                       the front photo. We feed this to Hunyuan3D / Rodin
 *                       so the AI does not pick up couches, plants, doors.
 *
 * Run once after deploy:
 *   npx ts-node --project tsconfig.json scripts/setup-scan-mode-mask-db.ts
 */
import { sql } from '@vercel/postgres'

async function main() {
  console.log('Adding scan_mode + masked_image_url to ai_scans...')
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS scan_mode VARCHAR(16) DEFAULT 'standing'`
  await sql`ALTER TABLE ai_scans ADD COLUMN IF NOT EXISTS masked_image_url TEXT`
  console.log('ok scan_mode + masked_image_url')
  console.log('\nDone.')
  process.exit(0)
}

main().catch((err) => { console.error('Migration failed:', err); process.exit(1) })
