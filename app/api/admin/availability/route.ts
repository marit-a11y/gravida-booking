import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createAvailability } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await sql`
      SELECT
        a.id,
        a.date::text,
        a.region,
        a.slots,
        a.max_per_slot,
        a.notes,
        a.is_active,
        a.created_at::text,
        COALESCE(
          jsonb_agg(b.time_slot ORDER BY b.time_slot) FILTER (WHERE b.time_slot IS NOT NULL AND b.status != 'cancelled'),
          '[]'::jsonb
        ) AS booked_slots
      FROM availability a
      LEFT JOIN bookings b ON b.availability_id = a.id AND b.status != 'cancelled'
      GROUP BY a.id
      ORDER BY a.date ASC, a.id ASC
    `
    return NextResponse.json({ availability: result.rows })
  } catch (err) {
    console.error('GET /api/admin/availability error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, region, slots, max_per_slot, notes } = body

    if (!date || !region || !slots || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: 'Datum, regio en tijdslots zijn verplicht' },
        { status: 400 }
      )
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Ongeldig datumformaat (gebruik YYYY-MM-DD)' }, { status: 400 })
    }

    const availability = await createAvailability({
      date,
      region: region.trim(),
      slots,
      max_per_slot: max_per_slot ?? 2,
      notes: notes?.trim() || undefined,
    })

    return NextResponse.json({ availability }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/availability error:', err)
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })
  }
}
