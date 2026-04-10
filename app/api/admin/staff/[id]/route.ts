import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const { name, email, regions, notes, is_active } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }
    const result = await sql`
      UPDATE staff SET
        name      = ${name.trim()},
        email     = ${email?.trim() || null},
        regions   = ${JSON.stringify(regions ?? [])}::jsonb,
        notes     = ${notes?.trim() || null},
        is_active = ${is_active ?? true}
      WHERE id = ${id}
      RETURNING id, name, email, regions, notes, is_active, created_at::text
    `
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Medewerker niet gevonden' }, { status: 404 })
    }
    return NextResponse.json(result.rows[0])
  } catch (err) {
    console.error('PUT /api/admin/staff/[id] error:', err)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    await sql`DELETE FROM staff WHERE id = ${id}`
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/admin/staff/[id] error:', err)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
