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
      // All Limburg availability (including closed)
      const limburgAll = await sql`
        SELECT id, date::text, region, is_active, is_closed, group_id::text
        FROM availability WHERE region = 'Limburg' AND date >= CURRENT_DATE
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
      // Exact replica of public API query
      const today = new Date().toISOString().split('T')[0]
      const region = 'Limburg'
      const publicQuery = await sql`
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
      return NextResponse.json({
        staff: staff.rows,
        today,
        limburg_all: limburgAll.rows,
        limburg_after_filter: limburgFiltered.rows,
        limburg_public_query: publicQuery.rows,
      })
    }

    if (mode === 'diy') {
      const name = searchParams.get('name') ?? ''
      const diyAll = name ? await sql`
        SELECT id, scanner_id, rental_week::text, first_name, last_name, email, phone,
               status, deposit_amount, deposit_status, payment_status, customer_number,
               notes, internal_notes, created_at::text
        FROM diy_rentals
        WHERE LOWER(first_name) LIKE LOWER(${'%' + name + '%'}) OR LOWER(last_name) LIKE LOWER(${'%' + name + '%'})
        ORDER BY created_at DESC
      ` : await sql`
        SELECT id, scanner_id, rental_week::text, first_name, last_name, email, phone,
               status, deposit_amount, deposit_status, payment_status, customer_number,
               notes, internal_notes, created_at::text
        FROM diy_rentals
        ORDER BY created_at DESC
      `
      return NextResponse.json({ search_name: name, count: diyAll.rows.length, results: diyAll.rows })
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
