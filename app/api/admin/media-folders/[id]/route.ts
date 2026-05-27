import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const e = await sql`SELECT * FROM media_folders WHERE id = ${id}`
    if (e.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const ex = e.rows[0]
    await sql`
      UPDATE media_folders SET
        name = ${body.name !== undefined ? body.name : ex.name},
        category = ${body.category !== undefined ? body.category : ex.category},
        description = ${body.description !== undefined ? body.description : ex.description},
        sort_order = ${body.sort_order !== undefined ? body.sort_order : ex.sort_order}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    // Items in deze map worden niet verwijderd, hun folder_id wordt NULL (zie ON DELETE SET NULL)
    await sql`DELETE FROM media_folders WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
