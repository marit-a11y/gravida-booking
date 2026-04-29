import { NextRequest, NextResponse } from 'next/server'
import { getBookingById } from '@/lib/db'
import { sendBookingUpdateEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const booking = await getBookingById(id)
    if (!booking) return NextResponse.json({ error: 'Boeking niet gevonden' }, { status: 404 })

    if (!booking.date || !booking.region) {
      return NextResponse.json({ error: 'Datum of regio ontbreekt' }, { status: 400 })
    }

    await sendBookingUpdateEmail({
      first_name: booking.first_name,
      email: booking.email,
      customer_number: booking.customer_number,
      date: booking.date,
      time_slot: booking.time_slot,
      region: booking.region,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/bookings/[id]/send-update-email error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
