import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const r = await sql`SELECT * FROM blog_posts WHERE id = ${id}`
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ post: r.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const e = await sql`SELECT * FROM blog_posts WHERE id = ${id}`
    if (e.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const ex = e.rows[0]
    const tagsArr = body.tags !== undefined ? (Array.isArray(body.tags) ? body.tags : []) : ex.tags
    const faqArr = body.faq_json !== undefined ? (Array.isArray(body.faq_json) ? body.faq_json : []) : (ex.faq_json ?? [])
    const relArr = body.related_keywords !== undefined ? (Array.isArray(body.related_keywords) ? body.related_keywords : []) : (ex.related_keywords ?? [])
    // Auto-set published_at if publishing for first time
    let publishedAt = body.published_at !== undefined ? body.published_at : ex.published_at
    if (body.is_published === true && !ex.is_published && !publishedAt) {
      publishedAt = new Date().toISOString()
    }
    await sql`
      UPDATE blog_posts SET
        title = ${body.title !== undefined ? body.title : ex.title},
        excerpt = ${body.excerpt !== undefined ? body.excerpt : ex.excerpt},
        content = ${body.content !== undefined ? body.content : ex.content},
        hero_image_url = ${body.hero_image_url !== undefined ? body.hero_image_url : ex.hero_image_url},
        category = ${body.category !== undefined ? body.category : ex.category},
        tags = ${JSON.stringify(tagsArr)}::jsonb,
        author = ${body.author !== undefined ? body.author : ex.author},
        is_published = ${body.is_published !== undefined ? body.is_published : ex.is_published},
        published_at = ${publishedAt},
        meta_title = ${body.meta_title !== undefined ? body.meta_title : ex.meta_title},
        meta_description = ${body.meta_description !== undefined ? body.meta_description : ex.meta_description},
        focus_keyword = ${body.focus_keyword !== undefined ? body.focus_keyword : ex.focus_keyword},
        key_takeaway = ${body.key_takeaway !== undefined ? body.key_takeaway : ex.key_takeaway},
        faq_json = ${JSON.stringify(faqArr)}::jsonb,
        related_keywords = ${JSON.stringify(relArr)}::jsonb,
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
    await sql`DELETE FROM blog_posts WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
