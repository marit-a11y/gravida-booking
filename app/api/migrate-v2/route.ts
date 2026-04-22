import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (new URL(request.url).searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }
  try {
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS customer_number VARCHAR(4)`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_diy_rentals_customer_number ON diy_rentals(customer_number) WHERE customer_number IS NOT NULL`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS internal_notes TEXT`
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS internal_notes TEXT`
    return NextResponse.json({ ok: true, message: 'Migratie voltooid: customer_number + internal_notes kolommen toegevoegd' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
