import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendReminderEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (or manually with the secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find all confirmed bookings exactly 7 days from today, reminder not yet sent
    const result = await sql`
      SELECT b.id, b.first_name, b.email, b.time_slot,
             a.date::text AS date, a.region
      FROM bookings b
      JOIN availability a ON b.availability_id = a.id
      WHERE a.date = CURRENT_DATE + INTERVAL '7 days'
        AND b.status != 'geannuleerd'
        AND b.reminder_sent = false
    `

    const bookings = result.rows
    let sent = 0
    const errors: string[] = []

    for (const booking of bookings) {
      try {
        await sendReminderEmail({
          first_name: booking.first_name,
          email: booking.email,
          date: booking.date,
          time_slot: booking.time_slot,
        })

        // Mark reminder as sent
        await sql`UPDATE bookings SET reminder_sent = true WHERE id = ${booking.id}`
        sent++
      } catch (err) {
        errors.push(`Booking ${booking.id}: ${String(err)}`)
        console.error(`Reminder failed for booking ${booking.id}:`, err)
      }
    }

    return NextResponse.json({
      checked: bookings.length,
      sent,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Cron reminders error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
