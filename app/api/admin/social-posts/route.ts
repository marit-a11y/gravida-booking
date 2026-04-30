import { NextRequest, NextResponse } from 'next/server'
import { getSocialPosts, createSocialPost } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined
    const posts = await getSocialPosts(from && to ? { from, to } : undefined)
    return NextResponse.json({ posts })
  } catch (err) {
    console.error('GET /api/admin/social-posts error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.scheduled_for) {
      return NextResponse.json({ error: 'scheduled_for is verplicht' }, { status: 400 })
    }
    const post = await createSocialPost({
      scheduled_for: body.scheduled_for,
      platform: body.platform,
      post_type: body.post_type,
      image_urls: body.image_urls,
      caption: body.caption,
      hashtags: body.hashtags,
      status: body.status,
      canva_url: body.canva_url,
      internal_notes: body.internal_notes,
    })
    return NextResponse.json({ post }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/social-posts error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + msg }, { status: 500 })
  }
}
