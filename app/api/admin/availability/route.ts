import { NextRequest, NextResponse } from 'next/server'
import { getAllAvailability, createAvailability } from '@/lib/db'

export async function GET() {
  try {
    const availability = await getAllAvailability()
    return NextResponse.json({ availability })
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

    // Validate date format
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
