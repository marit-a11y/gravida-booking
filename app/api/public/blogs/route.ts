import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const r = category
      ? await sql`
          SELECT id, slug, title, excerpt, hero_image_url, category, tags, author,
                 published_at::text, created_at::text
          FROM blog_posts
          WHERE is_published = true AND category = ${category}
          ORDER BY published_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : await sql`
          SELECT id, slug, title, excerpt, hero_image_url, category, tags, author,
                 published_at::text, created_at::text
          FROM blog_posts
          WHERE is_published = true
          ORDER BY published_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
    const count = category
      ? await sql`SELECT COUNT(*)::int AS n FROM blog_posts WHERE is_published = true AND category = ${category}`
      : await sql`SELECT COUNT(*)::int AS n FROM blog_posts WHERE is_published = true`
    return NextResponse.json({ posts: r.rows, total: count.rows[0]?.n ?? r.rows.length }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
