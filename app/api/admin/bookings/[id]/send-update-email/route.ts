import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getBookingById } from '@/lib/db'
import { sendBookingUpdateEmail, sendBookingUpdateStaffEmail } from '@/lib/email'

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

    // Customer mail
    await sendBookingUpdateEmail({
      first_name: booking.first_name,
      email: booking.email,
      customer_number: booking.customer_number,
      date: booking.date,
      time_slot: booking.time_slot,
      region: booking.region,
    })

    // Staff mail (parallel — zelfde data, andere ontvangers)
    const staffEmails = await sql`
      SELECT email FROM staff
      WHERE is_active = true
        AND email IS NOT NULL
        AND regions @> ${JSON.stringify([booking.region])}::jsonb
    `.then(r => r.rows.map(row => row.email as string)).catch(() => [] as string[])

    await sendBookingUpdateStaffEmail({
      first_name: booking.first_name,
      last_name: booking.last_name,
      email: booking.email,
      phone: booking.phone,
      customer_number: booking.customer_number,
      date: booking.date,
      time_slot: booking.time_slot,
      region: booking.region,
      address: booking.address,
      zip_code: booking.zip_code,
      city: booking.city,
      staff_emails: staffEmails,
    }).catch(err => console.error('Staff update mail error:', err))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/bookings/[id]/send-update-email error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
