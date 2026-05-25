import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const g = await sql`SELECT * FROM galleries WHERE id = ${id}`
    if (g.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const p = await sql`
      SELECT id, image_url, caption, sort_order FROM gallery_photos
      WHERE gallery_id = ${id} ORDER BY sort_order ASC, id ASC
    `
    return NextResponse.json({ gallery: g.rows[0], photos: p.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const e = await sql`SELECT * FROM galleries WHERE id = ${id}`
    if (e.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const ex = e.rows[0]
    await sql`
      UPDATE galleries SET
        title = ${body.title !== undefined ? body.title : ex.title},
        description = ${body.description !== undefined ? body.description : ex.description},
        cover_image_url = ${body.cover_image_url !== undefined ? body.cover_image_url : ex.cover_image_url},
        is_published = ${body.is_published !== undefined ? body.is_published : ex.is_published},
        sort_order = ${body.sort_order !== undefined ? body.sort_order : ex.sort_order},
        updated_at = NOW()
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
    await sql`DELETE FROM galleries WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
