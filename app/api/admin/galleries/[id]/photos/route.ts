import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// Add a photo (image_url + optional caption) to a gallery
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const { image_url, caption, sort_order } = body
    if (!image_url) return NextResponse.json({ error: 'image_url verplicht' }, { status: 400 })
    const r = await sql`
      INSERT INTO gallery_photos (gallery_id, image_url, caption, sort_order)
      VALUES (${id}, ${image_url}, ${caption ?? null}, ${sort_order ?? 0})
      RETURNING id, image_url, caption, sort_order
    `
    return NextResponse.json({ photo: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Replace order of photos in a gallery (bulk update via array of ids)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const { photo_ids } = body as { photo_ids: number[] }
    if (!Array.isArray(photo_ids)) return NextResponse.json({ error: 'photo_ids array verplicht' }, { status: 400 })
    for (let i = 0; i < photo_ids.length; i++) {
      await sql`UPDATE gallery_photos SET sort_order = ${i} WHERE id = ${photo_ids[i]} AND gallery_id = ${id}`
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
