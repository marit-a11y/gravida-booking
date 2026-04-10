import { NextRequest, NextResponse } from 'next/server'
import { getAvailabilityById, updateAvailability, deleteAvailability } from '@/lib/db'

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
    const { date, region, slots, max_per_slot, notes, is_active } = body

    const availability = await updateAvailability(id, {
      date,
      region: region?.trim(),
      slots,
      max_per_slot,
      notes: notes?.trim() || null,
      is_active,
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
