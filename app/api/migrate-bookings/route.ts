import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Simple key protection
  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }

  try {
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS date DATE`
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS region VARCHAR(200)`

    const updated = await sql`
      UPDATE bookings b
      SET date = a.date, region = a.region
      FROM availability a
      WHERE b.availability_id = a.id
        AND (b.date IS NULL OR b.region IS NULL)
    `

    return NextResponse.json({
      ok: true,
      message: 'Kolommen date en region toegevoegd aan bookings',
      backfilled: updated.rowCount,
    })
  } catch (err) {
    console.error('migrate-bookings error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
