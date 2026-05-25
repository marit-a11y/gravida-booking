import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const r = await sql`
      SELECT id, slug, title, excerpt, content, hero_image_url, category, tags, author,
             published_at::text, created_at::text
      FROM blog_posts
      WHERE slug = ${params.slug} AND is_published = true
      LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ post: r.rows[0] }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
