import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (new URL(request.url).searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }
  try {
    const before = await sql`
      SELECT a.id, a.date::text, a.region FROM availability a
      WHERE a.is_active = true AND a.is_closed = false AND a.date >= CURRENT_DATE
        AND EXISTS (
          SELECT 1 FROM bookings b
          LEFT JOIN availability a2 ON b.availability_id = a2.id
          WHERE COALESCE(b.date, a2.date) = a.date
            AND b.status != 'geannuleerd'
            AND b.availability_id != a.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM bookings b2
          WHERE b2.availability_id = a.id AND b2.status != 'geannuleerd'
        )
      ORDER BY a.date, a.region
    `
    const result = await sql`
      UPDATE availability a SET is_closed = true
      WHERE a.is_active = true AND a.is_closed = false AND a.date >= CURRENT_DATE
        AND EXISTS (
          SELECT 1 FROM bookings b
          LEFT JOIN availability a2 ON b.availability_id = a2.id
          WHERE COALESCE(b.date, a2.date) = a.date
            AND b.status != 'geannuleerd'
            AND b.availability_id != a.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM bookings b2
          WHERE b2.availability_id = a.id AND b2.status != 'geannuleerd'
        )
    `
    return NextResponse.json({ ok: true, closed: result.rowCount ?? 0, entries: before.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
