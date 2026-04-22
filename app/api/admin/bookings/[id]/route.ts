import { NextRequest, NextResponse } from 'next/server'
import { updateBookingStatus, updateBooking, getBookingById } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['bevestigd', 'afgerond', 'geannuleerd']
const EDITABLE_FIELDS = [
  'availability_id', 'time_slot', 'first_name', 'last_name', 'email', 'phone',
  'address', 'city', 'zip_code', 'pregnancy_weeks', 'notes', 'internal_notes',
  'date', 'region',
]

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json()
    const keys = Object.keys(body)
    const isStatusOnly = keys.length === 1 && keys[0] === 'status'

    // Status-only update (existing flow — keep compatible)
    if (isStatusOnly) {
      const { status } = body
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Ongeldige status. Kies uit: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      const booking = await updateBookingStatus(id, status)
      if (!booking) return NextResponse.json({ error: 'Boeking niet gevonden' }, { status: 404 })
      return NextResponse.json({ booking })
    }

    // Broader edit — pick only whitelisted fields
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Ongeldige status. Kies uit: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    const input: Record<string, unknown> = {}
    for (const k of EDITABLE_FIELDS) if (k in body) input[k] = body[k]
    if ('status' in body) input.status = body.status

    console.log('PUT /api/admin/bookings/[id]', { id, input, body })

    const booking = await updateBooking(id, input)
    if (!booking) return NextResponse.json({ error: 'Boeking niet gevonden' }, { status: 404 })

    console.log('PUT /api/admin/bookings/[id] saved', { id, time_slot: booking.time_slot, availability_id: booking.availability_id })

    // Include debug info in response (temporary) so we can see what actually happened
    return NextResponse.json({ booking, debug: { received: body, applied: input, result_time_slot: booking.time_slot, result_availability_id: booking.availability_id } })
  } catch (err) {
    console.error('PUT /api/admin/bookings/[id] error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Bijwerken mislukt: ' + msg }, { status: 500 })
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
