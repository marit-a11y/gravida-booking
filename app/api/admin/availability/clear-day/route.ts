import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

const BOOKABLE_REGIONS = [
  'Noord-Holland & Flevoland',
  'Utrecht & Gelderland & Overijssel',
  'Zuid-Holland',
  'Noord-Brabant',
  'Limburg',
  'Groningen, Friesland en Drenthe',
]

export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json()
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 })
    }

    const regionsJson = JSON.stringify(BOOKABLE_REGIONS)

    // Delete availability entries for bookable regions on this date,
    // EXCEPT any that have bookings linked (protect historical data).
    const result = await sql`
      DELETE FROM availability
      WHERE date = ${date}::date
        AND ${regionsJson}::jsonb @> jsonb_build_array(region)
        AND id NOT IN (
          SELECT DISTINCT availability_id
          FROM bookings
          WHERE availability_id IS NOT NULL
        )
    `

    // Count entries that were skipped because they have bookings
    const skippedResult = await sql`
      SELECT COUNT(*) as count FROM availability
      WHERE date = ${date}::date
        AND ${regionsJson}::jsonb @> jsonb_build_array(region)
    `
    const skipped = parseInt(skippedResult.rows[0].count, 10)

    return NextResponse.json({
      ok: true,
      deleted: result.rowCount ?? 0,
      skipped_with_bookings: skipped,
    })
  } catch (err) {
    console.error('POST /api/admin/availability/clear-day error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
