import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 150)
}

export async function GET() {
  try {
    const r = await sql`
      SELECT id, slug, title, excerpt, hero_image_url, category, tags, author,
             is_published, published_at::text, created_at::text, updated_at::text
      FROM blog_posts
      ORDER BY COALESCE(published_at, created_at) DESC
    `
    return NextResponse.json({ posts: r.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title, excerpt, content, hero_image_url, category, tags, author, is_published, published_at,
      meta_title, meta_description, focus_keyword, key_takeaway, faq_json, related_keywords,
    } = body
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Titel en content zijn verplicht' }, { status: 400 })
    }
    let slug = slugify(title)
    let n = 1
    while ((await sql`SELECT id FROM blog_posts WHERE slug = ${slug} LIMIT 1`).rows.length > 0) {
      slug = `${slugify(title)}-${++n}`
    }
    const tagsArr = Array.isArray(tags) ? tags : []
    const faqArr = Array.isArray(faq_json) ? faq_json : []
    const relArr = Array.isArray(related_keywords) ? related_keywords : []
    const r = await sql`
      INSERT INTO blog_posts (
        slug, title, excerpt, content, hero_image_url, category, tags, author, is_published, published_at,
        meta_title, meta_description, focus_keyword, key_takeaway, faq_json, related_keywords
      )
      VALUES (
        ${slug}, ${title.trim()}, ${excerpt ?? null}, ${content},
        ${hero_image_url ?? null}, ${category ?? null}, ${JSON.stringify(tagsArr)}::jsonb,
        ${author ?? null}, ${is_published ?? false},
        ${is_published && !published_at ? new Date().toISOString() : (published_at ?? null)},
        ${meta_title ?? null}, ${meta_description ?? null}, ${focus_keyword ?? null},
        ${key_takeaway ?? null}, ${JSON.stringify(faqArr)}::jsonb, ${JSON.stringify(relArr)}::jsonb
      )
      RETURNING id, slug, title, is_published
    `
    return NextResponse.json({ post: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + String(err) }, { status: 500 })
  }
}
