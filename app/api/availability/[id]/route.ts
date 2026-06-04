import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getAvailabilityById, getBookingCountForSlot } from '@/lib/db'
import { getDisplaySlotsForRegion } from '@/lib/region-slots'

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
    const dbBlocked: string[] = Array.isArray(bRow.rows[0]?.blocked_slots)
      ? (bRow.rows[0].blocked_slots as string[])
      : []

    // Display-set: wat zou een volledige dag in deze regio normaal tonen?
    // Slots die NIET in availability.slots zitten, presenteren we ook als 'Vol'.
    const displaySet = getDisplaySlotsForRegion(availability.region)

    // Universum = bookable slots + db blocked + display fillers
    const universe = [...new Set([...availability.slots, ...dbBlocked, ...displaySet])].sort()

    const bookableSet = new Set(availability.slots)
    const slotsWithCounts = await Promise.all(
      universe.map(async (slot) => {
        // Tellingen alleen relevant voor echte bookable slots
        const count = bookableSet.has(slot) ? await getBookingCountForSlot(id, slot) : 0
        const isExplicitBlocked = dbBlocked.includes(slot)
        const isOutsideBookable = !bookableSet.has(slot)
        const isFull = count >= availability.max_per_slot
        const blocked = isExplicitBlocked || isOutsideBookable
        return {
          slot,
          count,
          available: !blocked && !isFull,
          blocked,
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
