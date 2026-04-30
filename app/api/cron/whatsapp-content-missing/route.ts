import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendWhatsAppTemplate, isWhatsAppConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface IncompletePost {
  id: number
  scheduled_for: string
  title: string | null
  category: string | null
  post_type: string
  image_urls: string[]
  caption: string | null
}

/**
 * Daily check (around 17:00): are there any posts scheduled for tomorrow that
 * are still missing media OR caption? If so, send a WhatsApp reminder per post.
 *
 * Uses template `gravida_content_missing` with parameters:
 *   {{1}} = time (HH:MM)
 *   {{2}} = title (or category)
 *   {{3}} = post_type (feed/story/reel)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isWhatsAppConfigured()) {
    return NextResponse.json({ ok: false, skipped: 'WhatsApp not configured' })
  }

  try {
    const result = await sql<IncompletePost>`
      SELECT id, scheduled_for::text, title, category, post_type, image_urls, caption
      FROM social_posts
      WHERE scheduled_for::date = CURRENT_DATE + INTERVAL '1 day'
        AND status IN ('draft', 'scheduled')
        AND (
          (jsonb_typeof(image_urls) = 'array' AND jsonb_array_length(image_urls) = 0)
          OR caption IS NULL OR caption = ''
        )
      ORDER BY scheduled_for ASC
    `

    const items = result.rows
    if (items.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'Geen incomplete posts voor morgen' })
    }

    const templateName = process.env.WHATSAPP_TEMPLATE_CONTENT_MISSING ?? 'gravida_content_missing'
    let sent = 0
    const errors: string[] = []

    for (const post of items) {
      const t = new Date(post.scheduled_for)
      const time = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
      const titleOrCategory = post.title || post.category || 'onbekend'
      const result = await sendWhatsAppTemplate(templateName, [time, titleOrCategory, post.post_type])
      if (result.ok) sent++
      else errors.push(`#${post.id}: ${result.error}`)
    }

    return NextResponse.json({ ok: true, sent, total: items.length, errors })
  } catch (err) {
    console.error('cron/whatsapp-content-missing error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
