import { NextRequest, NextResponse } from 'next/server'
import { getAvailabilityById, updateAvailability, deleteAvailability, getGroupMemberIds, setGroupForIds, clearGroupForIds } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const availability = await getAvailabilityById(id)
    if (!availability) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    return NextResponse.json({ availability })
  } catch (err) {
    console.error('GET /api/admin/availability/[id] error:', err)
    return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json()
    const { date, region, slots, max_per_slot, notes, is_active, is_closed, link_with_ids } = body

    // ── Handle group linking ───────────────────────────────────────────────────
    // link_with_ids is an array of other availability IDs to group with this one.
    // undefined = don't touch groups; [] = remove from group; [1,2] = create/update group
    if (link_with_ids !== undefined) {
      // Find current group and clear all its members
      const existing = await getAvailabilityById(id)
      if (existing?.group_id) {
        const currentMembers = await getGroupMemberIds(existing.group_id)
        await clearGroupForIds(currentMembers)
      } else {
        await clearGroupForIds([id])
      }

      // If new links are provided, assign a fresh shared group_id
      if (Array.isArray(link_with_ids) && link_with_ids.length > 0) {
        const newGroupId = crypto.randomUUID()
        await setGroupForIds([id, ...link_with_ids], newGroupId)
      }
    }

    const availability = await updateAvailability(id, {
      date,
      region: region?.trim(),
      slots,
      max_per_slot,
      notes: notes?.trim() ?? null,
      is_active,
      is_closed,
    })

    if (!availability) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    return NextResponse.json({ availability })
  } catch (err) {
    console.error('PUT /api/admin/availability/[id] error:', err)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const deleted = await deleteAvailability(id)
    if (!deleted) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/availability/[id] error:', err)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
