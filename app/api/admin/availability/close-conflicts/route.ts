import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Close availability entries on dates that already have active bookings in
 * OTHER regions (likely studio scans). Mirrors the closeSiblings behavior so
 * staff can't be double-booked across regions on the same day.
 *
 * Skips entries that themselves have bookings — they stay open.
 */
export async function POST() {
  try {
    const result = await sql`
      UPDATE availability a
      SET is_closed = true
      WHERE a.is_active = true
        AND a.is_closed = false
        AND a.date >= CURRENT_DATE
        AND EXISTS (
          SELECT 1 FROM bookings b
          LEFT JOIN availability a2 ON b.availability_id = a2.id
          WHERE COALESCE(b.date, a2.date) = a.date
            AND b.status != 'geannuleerd'
            AND b.availability_id != a.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM bookings b2
          WHERE b2.availability_id = a.id
            AND b2.status != 'geannuleerd'
        )
    `
    return NextResponse.json({ ok: true, closed: result.rowCount ?? 0 })
  } catch (err) {
    console.error('close-conflicts error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
