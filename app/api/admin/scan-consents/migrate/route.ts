import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS scan_consents (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        diy_rental_id INTEGER REFERENCES diy_rentals(id) ON DELETE CASCADE,
        token VARCHAR(40) UNIQUE NOT NULL,

        -- Door Laila/Marit ingevuld na de scan
        material VARCHAR(10),
        finish VARCHAR(50),
        size VARCHAR(30),
        size_other TEXT,
        with_arms BOOLEAN,
        weighted BOOLEAN,
        internal_notes TEXT,

        -- Door klant beantwoord via formulier
        consent_storage_files BOOLEAN,
        consent_marketing_use BOOLEAN,
        shipping_insured BOOLEAN,
        digital_wishes TEXT,

        -- Tijdstempels
        sent_at TIMESTAMPTZ,
        submitted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_scan_consents_booking ON scan_consents(booking_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_scan_consents_rental ON scan_consents(diy_rental_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_scan_consents_token ON scan_consents(token)`
    return NextResponse.json({ ok: true, message: 'scan_consents tabel klaar' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
