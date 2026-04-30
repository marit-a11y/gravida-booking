import { NextRequest, NextResponse } from 'next/server'
import { updateSocialPost, deleteSocialPost, getSocialPostById } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const post = await getSocialPostById(id)
    if (!post) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ post })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const post = await updateSocialPost(id, body)
    if (!post) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ post })
  } catch (err) {
    console.error('PUT /api/admin/social-posts/[id] error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Bijwerken mislukt: ' + msg }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const ok = await deleteSocialPost(id)
    if (!ok) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
