import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await sql`
      SELECT a.id, a.staff_id, s.name AS staff_name,
             a.date_from::text, a.date_to::text,
             a.reason, a.notes, a.created_at::text
      FROM absence a
      JOIN staff s ON s.id = a.staff_id
      ORDER BY a.date_from ASC
    `
    return NextResponse.json({ absence: result.rows })
  } catch (err) {
    console.error('GET /api/admin/absence error:', err)
    return NextResponse.json({ error: 'Kan afwezigheid niet laden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff_id, date_from, date_to, reason, notes } = await request.json()
    if (!staff_id || !date_from || !date_to) {
      return NextResponse.json({ error: 'Medewerker, startdatum en einddatum zijn verplicht' }, { status: 400 })
    }
    if (date_to < date_from) {
      return NextResponse.json({ error: 'Einddatum moet na startdatum zijn' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO absence (staff_id, date_from, date_to, reason, notes)
      VALUES (
        ${staff_id},
        ${date_from},
        ${date_to},
        ${reason?.trim() || 'Vrije dag'},
        ${notes?.trim() || null}
      )
      RETURNING id, staff_id, date_from::text, date_to::text, reason, notes, created_at::text
    `
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/absence error:', err)
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })
  }
}
