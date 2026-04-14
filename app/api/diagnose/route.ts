import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name') ?? 'sophie'

    // Search bookings by name (case insensitive), including cancelled, including orphaned availability
    const byName = await sql`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.email, b.phone, b.status,
             b.created_at::text, a.date::text as date, a.region
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE LOWER(b.first_name) LIKE LOWER(${'%' + name + '%'})
         OR LOWER(b.last_name) LIKE LOWER(${'%' + name + '%'})
      ORDER BY b.created_at DESC
    `

    // Also check: bookings whose availability_id points to nothing
    const orphaned = await sql`
      SELECT b.id, b.customer_number, b.availability_id, b.time_slot,
             b.first_name, b.last_name, b.status, b.created_at::text
      FROM bookings b
      LEFT JOIN availability a ON b.availability_id = a.id
      WHERE a.id IS NULL
    `

    // Counter state
    const counter = await sql`SELECT last_number FROM customer_counter WHERE id = 1`

    return NextResponse.json({
      search_name: name,
      results: byName.rows,
      orphaned_bookings: orphaned.rows,
      customer_counter: counter.rows[0]?.last_number,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
