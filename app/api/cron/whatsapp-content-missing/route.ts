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
}

/**
 * Daily check (around 17:00 UTC): are there posts scheduled for tomorrow that
 * still miss media OR caption? If so, send a WhatsApp reminder per post.
 *
 * IDEMPOTENT: claimt rijen atomair via content_missing_sent flag, zodat
 * herhaald draaien van de cron op dezelfde dag nooit dubbele berichten oplevert.
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
    const claimed = await sql<IncompletePost>`
      UPDATE social_posts
      SET content_missing_sent = true
      WHERE id IN (
        SELECT id FROM social_posts
        WHERE scheduled_for::date = CURRENT_DATE + INTERVAL '1 day'
          AND status IN ('draft', 'scheduled')
          AND content_missing_sent = false
          AND (
            (jsonb_typeof(image_urls) = 'array' AND jsonb_array_length(image_urls) = 0)
            OR caption IS NULL OR caption = ''
          )
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, scheduled_for::text, title, category, post_type
    `

    const items = claimed.rows
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
      const result = await sendWhatsAppTemplate(
        templateName,
        [time, titleOrCategory, post.post_type],
        'nl',
        undefined,
        String(post.id),
      )
      if (result.ok) sent++
      else errors.push(`#${post.id}: ${result.error}`)
    }

    return NextResponse.json({ ok: true, sent, total: items.length, errors })
  } catch (err) {
    console.error('cron/whatsapp-content-missing error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
