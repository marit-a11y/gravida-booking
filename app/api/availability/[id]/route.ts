import { NextRequest, NextResponse } from 'next/server'
import { getAvailabilityById, getBookingCountForSlot } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })
    }

    const availability = await getAvailabilityById(id)
    if (!availability) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    // For each slot, check how many bookings exist and whether it's still available
    const slotsWithCounts = await Promise.all(
      availability.slots.map(async (slot) => {
        const count = await getBookingCountForSlot(id, slot)
        return {
          slot,
          count,
          available: count < availability.max_per_slot,
        }
      })
    )

    return NextResponse.json({
      id: availability.id,
      date: availability.date,
      region: availability.region,
      max_per_slot: availability.max_per_slot,
      notes: availability.notes,
      slots: slotsWithCounts,
    })
  } catch (err) {
    console.error('GET /api/availability/[id] error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}
