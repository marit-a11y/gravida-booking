import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') ?? 'booking'

    if (mode === 'absence') {
      // Debug absence filtering
      const staff = await sql`
        SELECT id, name, regions, is_active FROM staff WHERE is_active = true
      `
      const absences = await sql`
        SELECT ab.id, ab.staff_id, s.name as staff_name, ab.date_from::text, ab.date_to::text, ab.reason
        FROM absence ab JOIN staff s ON ab.staff_id = s.id
        ORDER BY ab.date_from DESC
      `
      const avail21 = await sql`
        SELECT id, date::text, region, slots, is_active, is_closed
        FROM availability
        WHERE date = '2026-04-21'::date
      `
      // Test the exact query used in public API for each region on april 21
      const testNH = await sql`
        SELECT a.id, a.date::text, a.region
        FROM availability a
        WHERE a.is_active = true AND a.is_closed = false AND a.date = '2026-04-21'::date
          AND EXISTS (
            SELECT 1 FROM staff s
            WHERE s.is_active = true
              AND s.regions @> ${JSON.stringify(['Noord-Holland & Flevoland'])}::jsonb
              AND NOT EXISTS (
                SELECT 1 FROM absence ab
                WHERE ab.staff_id = s.id
                  AND ab.date_from <= a.date
                  AND ab.date_to >= a.date
              )
          )
      `
      // All Limburg availability (unfiltered)
      const limburgAll = await sql`
        SELECT id, date::text, region, is_active, is_closed
        FROM availability WHERE region = 'Limburg' AND is_active = true AND is_closed = false AND date >= CURRENT_DATE
        ORDER BY date ASC
      `
      // Limburg through public filter
      const limburgFiltered = await sql`
        SELECT a.id, a.date::text, a.region
        FROM availability a
        WHERE a.is_active = true AND a.is_closed = false AND a.date >= CURRENT_DATE
          AND a.region = 'Limburg'
          AND EXISTS (
            SELECT 1 FROM staff s
            WHERE s.is_active = true
              AND s.regions @> ${JSON.stringify(['Limburg'])}::jsonb
              AND NOT EXISTS (
                SELECT 1 FROM absence ab
                WHERE ab.staff_id = s.id
                  AND ab.date_from <= a.date
                  AND ab.date_to >= a.date
              )
          )
        ORDER BY a.date ASC
      `
      return NextResponse.json({
        staff: staff.rows,
        absences: absences.rows,
        limburg_all: limburgAll.rows,
        limburg_after_filter: limburgFiltered.rows,
      })
    }

    // Default: booking search
    const name = searchParams.get('name') ?? 'sophie'
    const byName = await sql`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.status,
             b.created_at::text, a.date::text as date, a.region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE LOWER(b.first_name) LIKE LOWER(${'%' + name + '%'})
         OR LOWER(b.last_name) LIKE LOWER(${'%' + name + '%'})
      ORDER BY b.created_at DESC
    `
    const orphaned = await sql`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.status, b.created_at::text
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE a.id IS NULL
    `
    const counter = await sql`SELECT last_number FROM customer_counter WHERE id = 1`

    return NextResponse.json({
      search_name: name,
      results: byName.rows,
      orphaned_bookings: orphaned.rows,
      customer_counter: counter.rows[0]?.last_number,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
