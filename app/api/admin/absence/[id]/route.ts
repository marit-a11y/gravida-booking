import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const { staff_id, date_from, date_to, reason, notes } = await request.json()
    if (!staff_id || !date_from || !date_to) {
      return NextResponse.json({ error: 'Medewerker, startdatum en einddatum zijn verplicht' }, { status: 400 })
    }
    if (date_to < date_from) {
      return NextResponse.json({ error: 'Einddatum moet na startdatum zijn' }, { status: 400 })
    }
    const result = await sql`
      UPDATE absence SET
        staff_id  = ${staff_id},
        date_from = ${date_from},
        date_to   = ${date_to},
        reason    = ${reason?.trim() || 'Vrije dag'},
        notes     = ${notes?.trim() || null}
      WHERE id = ${id}
      RETURNING id, staff_id, date_from::text, date_to::text, reason, notes, created_at::text
    `
    if (result.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('PUT /api/admin/absence/[id] error:', err)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    await sql`DELETE FROM absence WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/absence/[id] error:', err)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
