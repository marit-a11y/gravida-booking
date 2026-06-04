import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getAvailabilityById, getBookingCountForSlot } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

    // Geblokkeerde slots ophalen (admin/cron sluit deze handmatig af)
    const bRow = await sql`SELECT blocked_slots FROM availability WHERE id = ${id}`
    const blockedSlots: string[] = Array.isArray(bRow.rows[0]?.blocked_slots)
      ? (bRow.rows[0].blocked_slots as string[])
      : []

    // Verzamel slots: open uit availability.slots + geblokkeerde slots (om als 'Vol' te tonen)
    const allSlots = [...new Set([...availability.slots, ...blockedSlots])].sort()

    const slotsWithCounts = await Promise.all(
      allSlots.map(async (slot) => {
        const count = await getBookingCountForSlot(id, slot)
        const isBlocked = blockedSlots.includes(slot)
        const isFull = count >= availability.max_per_slot
        return {
          slot,
          count,
          available: !isBlocked && !isFull,
          blocked: isBlocked,
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
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'CDN-Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/availability/[id] error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}
