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
      SELECT f.id, f.name, f.slug, f.category, f.description, f.sort_order, f.parent_id,
             (SELECT COUNT(*) FROM media_item_folders mif WHERE mif.folder_id = f.id)::int AS item_count
      FROM media_folders f
      ORDER BY f.sort_order ASC, f.name ASC
    `
    return NextResponse.json({ folders: r.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, description, sort_order, parent_id } = body
    if (!name?.trim()) return NextResponse.json({ error: 'Naam verplicht' }, { status: 400 })
    let slug = slugify(name)
    let n = 1
    while ((await sql`SELECT id FROM media_folders WHERE slug = ${slug} LIMIT 1`).rows.length > 0) {
      slug = `${slugify(name)}-${++n}`
    }
    const r = await sql`
      INSERT INTO media_folders (name, slug, category, description, sort_order, parent_id)
      VALUES (${name.trim()}, ${slug}, ${category ?? null}, ${description ?? null},
              ${sort_order ?? 0}, ${parent_id ?? null})
      RETURNING id, name, slug, category, description, sort_order, parent_id
    `
    return NextResponse.json({ folder: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + String(err) }, { status: 500 })
  }
}
