import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const e = await sql`SELECT * FROM gallery_photos WHERE id = ${id}`
    if (e.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const ex = e.rows[0]
    await sql`
      UPDATE gallery_photos SET
        caption = ${body.caption !== undefined ? body.caption : ex.caption},
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
    await sql`DELETE FROM gallery_photos WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
