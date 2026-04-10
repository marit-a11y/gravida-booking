import { NextRequest, NextResponse } from 'next/server'
import { getAvailability } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') ?? undefined

    const availability = await getAvailability(date)

    // Return only the data needed for the public booking page
    const publicData = availability.map((a) => ({
      id: a.id,
      date: a.date,
      region: a.region,
      slots: a.slots,
      max_per_slot: a.max_per_slot,
      notes: a.notes,
    }))

    return NextResponse.json(publicData)
  } catch (err) {
    console.error('GET /api/availability error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}
