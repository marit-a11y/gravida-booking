import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const g = await sql`
      SELECT id, slug, title, description, cover_image_url, created_at::text
      FROM galleries
      WHERE slug = ${params.slug} AND is_published = true
      LIMIT 1
    `
    if (g.rows.length === 0) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }
    const gallery = g.rows[0]
    const p = await sql`
      SELECT id, image_url, caption, sort_order
      FROM gallery_photos
      WHERE gallery_id = ${gallery.id}
      ORDER BY sort_order ASC, id ASC
    `
    return NextResponse.json({ gallery, photos: p.rows }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
