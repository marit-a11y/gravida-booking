import { NextRequest, NextResponse } from 'next/server'
import { updateBookingStatus, getBookingById } from '@/lib/db'

const VALID_STATUSES = ['bevestigd', 'afgerond', 'geannuleerd']

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Ongeldige status. Kies uit: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const booking = await updateBookingStatus(id, status)
    if (!booking) return NextResponse.json({ error: 'Boeking niet gevonden' }, { status: 404 })

    return NextResponse.json({ booking })
  } catch (err) {
    console.error('PUT /api/admin/bookings/[id] error:', err)
    return NextResponse.json({ error: 'Status bijwerken mislukt' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const booking = await getBookingById(id)
    if (!booking) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    return NextResponse.json({ booking })
  } catch (err) {
    console.error('GET /api/admin/bookings/[id] error:', err)
    return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 })
  }
}
