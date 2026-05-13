import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Velden toevoegen aan diy_rentals voor feedback + borg-keuze
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS feedback_token VARCHAR(40)`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS feedback_sent_at TIMESTAMPTZ`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS feedback_submitted_at TIMESTAMPTZ`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS scanner_issues TEXT`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS deposit_choice VARCHAR(20)`
    // deposit_choice: 'refund' / 'order_credit' / 'giftcard'
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS giftcard_id INTEGER REFERENCES gift_cards(id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_diy_rentals_feedback_token ON diy_rentals(feedback_token)`
    // Defect / opmerking bij retour (alleen team)
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS scanner_defect TEXT`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS return_received_at TIMESTAMPTZ`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS shipped_email_sent_at TIMESTAMPTZ`
    return NextResponse.json({ ok: true, message: 'DIY feedback velden toegevoegd' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
