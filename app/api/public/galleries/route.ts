import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// CORS-friendly publieke endpoint voor gravida.nl frontend
export async function GET() {
  try {
    const r = await sql`
      SELECT g.id, g.slug, g.title, g.description, g.cover_image_url,
             g.sort_order, g.created_at::text,
             (SELECT COUNT(*) FROM gallery_photos p WHERE p.gallery_id = g.id)::int AS photo_count
      FROM galleries g
      WHERE g.is_published = true
      ORDER BY g.sort_order ASC, g.id DESC
    `
    return NextResponse.json({ galleries: r.rows }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
