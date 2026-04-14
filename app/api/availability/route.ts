import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get('region') ?? null
    const today = new Date().toISOString().split('T')[0]

    // Filter out dates where ALL staff for the region are absent
    // A date is available if at least 1 active staff member covers the region
    // and is NOT absent on that date
    let rows
    if (region) {
      const result = await sql`
        SELECT a.id, a.date::text, a.region, a.slots, a.max_per_slot, a.notes
        FROM availability a
        WHERE a.is_active = true AND a.is_closed = false AND a.date >= ${today}
          AND a.region = ${region}
          AND EXISTS (
            SELECT 1 FROM staff s
            WHERE s.is_active = true
              AND s.regions @> ${JSON.stringify([region])}::jsonb
              AND NOT EXISTS (
                SELECT 1 FROM absence ab
                WHERE ab.staff_id = s.id
                  AND ab.date_from <= a.date
                  AND ab.date_to >= a.date
              )
          )
        ORDER BY a.date ASC
      `
      rows = result.rows
    } else {
      const result = await sql`
        SELECT a.id, a.date::text, a.region, a.slots, a.max_per_slot, a.notes
        FROM availability a
        WHERE a.is_active = true AND a.is_closed = false AND a.date >= ${today}
          AND EXISTS (
            SELECT 1 FROM staff s
            WHERE s.is_active = true
              AND s.regions @> to_jsonb(ARRAY[a.region])
              AND NOT EXISTS (
                SELECT 1 FROM absence ab
                WHERE ab.staff_id = s.id
                  AND ab.date_from <= a.date
                  AND ab.date_to >= a.date
              )
          )
        ORDER BY a.date ASC
      `
      rows = result.rows
    }

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/availability error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}
