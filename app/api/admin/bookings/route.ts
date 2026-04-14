import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createBooking, getAvailabilityById } from '@/lib/db'
import { sendBookingEmails } from '@/lib/email'
import { bookingsToCsv } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date     = searchParams.get('date')   || null
    const region   = searchParams.get('region') || null
    const status   = searchParams.get('status') || null
    const exportCsv    = searchParams.get('export') === 'csv'
    const includeStats = searchParams.get('stats') === '1'

    // Use COALESCE so bookings survive availability deletion
    // b.date / b.region are the denormalised copies; a.date / a.region are the JOIN fallbacks
    let bookings: Record<string, unknown>[] = []

    if (date && region && status) {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE COALESCE(b.date, a.date) = ${date}::date
          AND COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'}
          AND b.status = ${status}
        ORDER BY COALESCE(b.date, a.date) ASC, b.time_slot ASC`
      bookings = r.rows
    } else if (date && region) {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE COALESCE(b.date, a.date) = ${date}::date
          AND COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'}
        ORDER BY COALESCE(b.date, a.date) ASC, b.time_slot ASC`
      bookings = r.rows
    } else if (date && status) {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE COALESCE(b.date, a.date) = ${date}::date AND b.status = ${status}
        ORDER BY COALESCE(b.date, a.date) ASC, b.time_slot ASC`
      bookings = r.rows
    } else if (region && status) {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'} AND b.status = ${status}
        ORDER BY COALESCE(b.date, a.date) ASC, b.time_slot ASC`
      bookings = r.rows
    } else if (date) {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE COALESCE(b.date, a.date) = ${date}::date
        ORDER BY b.time_slot ASC`
      bookings = r.rows
    } else if (region) {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE COALESCE(b.region, a.region) ILIKE ${'%' + region + '%'}
        ORDER BY COALESCE(b.date, a.date) ASC, b.time_slot ASC`
      bookings = r.rows
    } else if (status) {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE b.status = ${status}
        ORDER BY COALESCE(b.date, a.date) ASC, b.time_slot ASC`
      bookings = r.rows
    } else {
      const r = await sql`
        SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
               b.first_name, b.last_name, b.email, b.phone, b.address,
               b.city, b.zip_code, b.pregnancy_weeks, b.notes, b.status,
               b.created_at::text,
               COALESCE(b.date, a.date)::text as date,
               COALESCE(b.region, a.region) as region
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        ORDER BY COALESCE(b.date, a.date) ASC, b.time_slot ASC`
      bookings = r.rows
    }

    // CSV export
    if (exportCsv) {
      const csv = bookingsToCsv(bookings)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="gravida-boekingen-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Include stats if requested
    if (includeStats) {
      const [total, week, today] = await Promise.all([
        sql`SELECT COUNT(*) as count FROM bookings WHERE status != 'geannuleerd'`,
        sql`SELECT COUNT(*) as count FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
            WHERE COALESCE(b.date, a.date) >= DATE_TRUNC('week', CURRENT_DATE)
              AND COALESCE(b.date, a.date) < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
              AND b.status != 'geannuleerd'`,
        sql`SELECT COUNT(*) as count FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
            WHERE COALESCE(b.date, a.date) = CURRENT_DATE AND b.status != 'geannuleerd'`,
      ])
      return NextResponse.json({
        bookings,
        stats: {
          total: parseInt(total.rows[0].count, 10),
          thisWeek: parseInt(week.rows[0].count, 10),
          today: parseInt(today.rows[0].count, 10),
        },
      })
    }

    return NextResponse.json({ bookings })
  } catch (err) {
    console.error('GET /api/admin/bookings error:', err)
    return NextResponse.json({ error: 'Kan boekingen niet laden', detail: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      availability_id,
      time_slot,
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      zip_code,
      pregnancy_weeks,
      notes,
    } = body

    if (!availability_id || !time_slot || !first_name || !last_name || !email || !phone || !address || !city || !zip_code) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    const booking = await createBooking({
      availability_id,
      time_slot,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      address: address.trim(),
      city: city.trim(),
      zip_code: zip_code.trim(),
      pregnancy_weeks: pregnancy_weeks ? parseInt(pregnancy_weeks) : undefined,
      notes: notes?.trim() || undefined,
    })

    // Send confirmation + staff notification emails (non-blocking)
    const availability = await getAvailabilityById(availability_id)
    if (availability) {
      const staffEmails = await sql`
        SELECT email FROM staff
        WHERE is_active = true
          AND email IS NOT NULL
          AND regions @> ${JSON.stringify([availability.region])}::jsonb
      `.then(r => r.rows.map(row => row.email as string)).catch(() => [] as string[])

      sendBookingEmails({
        customer_number: booking.customer_number,
        first_name: booking.first_name,
        last_name: booking.last_name,
        email: booking.email,
        phone: booking.phone,
        address: booking.address,
        zip_code: booking.zip_code,
        city: booking.city,
        date: availability.date,
        time_slot: booking.time_slot,
        region: availability.region,
        pregnancy_weeks: booking.pregnancy_weeks,
        notes: booking.notes,
        staff_emails: staffEmails,
      }).catch(err => console.error('sendBookingEmails error:', err))
    }

    return NextResponse.json(booking, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/bookings error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
