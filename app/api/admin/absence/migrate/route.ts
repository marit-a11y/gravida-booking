import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS absence (
        id         SERIAL PRIMARY KEY,
        staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        date_from  DATE NOT NULL,
        date_to    DATE NOT NULL,
        reason     VARCHAR(100) NOT NULL DEFAULT 'Vrije dag',
        notes      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS absence_staff_idx ON absence(staff_id)`
    await sql`CREATE INDEX IF NOT EXISTS absence_dates_idx ON absence(date_from, date_to)`
    return NextResponse.json({ ok: true, message: 'absence tabel aangemaakt' })
  } catch (err) {
    console.error('absence migrate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
