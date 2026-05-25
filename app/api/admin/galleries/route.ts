import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
}

export async function GET() {
  try {
    const r = await sql`
      SELECT g.id, g.slug, g.title, g.description, g.cover_image_url, g.is_published,
             g.sort_order, g.created_at::text, g.updated_at::text,
             (SELECT COUNT(*) FROM gallery_photos p WHERE p.gallery_id = g.id)::int AS photo_count
      FROM galleries g
      ORDER BY g.sort_order ASC, g.id DESC
    `
    return NextResponse.json({ galleries: r.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, cover_image_url, is_published, sort_order } = body
    if (!title?.trim()) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    let slug = slugify(title)
    // uniqueness
    let n = 1
    while ((await sql`SELECT id FROM galleries WHERE slug = ${slug} LIMIT 1`).rows.length > 0) {
      slug = `${slugify(title)}-${++n}`
    }
    const r = await sql`
      INSERT INTO galleries (slug, title, description, cover_image_url, is_published, sort_order)
      VALUES (${slug}, ${title.trim()}, ${description ?? null}, ${cover_image_url ?? null},
              ${is_published ?? false}, ${sort_order ?? 0})
      RETURNING id, slug, title, description, cover_image_url, is_published, sort_order
    `
    return NextResponse.json({ gallery: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + String(err) }, { status: 500 })
  }
}
