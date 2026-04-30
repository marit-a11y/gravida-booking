import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendWhatsAppTemplate, isWhatsAppConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface DuePost {
  id: number
  scheduled_for: string
  title: string | null
  category: string | null
  post_type: string
}

/**
 * Runs every 15 minutes. Sends a WhatsApp reminder for posts that go live
 * within the next 15 minutes (if their reminder hasn't been sent yet).
 *
 * Uses template `gravida_post_reminder` with parameters:
 *   {{1}} = title (or category)
 *   {{2}} = time (HH:MM)
 *   {{3}} = post_type
 *
 * Sets reminder_sent = true after successful delivery so we don't double-fire.
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
    // Find posts scheduled in the next 15 minutes (window includes "right now"
    // up to 15 min ahead) that are still scheduled and haven't been reminded.
    const result = await sql<DuePost>`
      SELECT id, scheduled_for::text, title, category, post_type
      FROM social_posts
      WHERE scheduled_for >= NOW()
        AND scheduled_for <= NOW() + INTERVAL '15 minutes'
        AND status IN ('draft', 'scheduled', 'klaargezet')
        AND reminder_sent = false
      ORDER BY scheduled_for ASC
    `

    const items = result.rows
    if (items.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const templateName = process.env.WHATSAPP_TEMPLATE_POST_REMINDER ?? 'gravida_post_reminder'
    let sent = 0
    const errors: string[] = []

    for (const post of items) {
      const t = new Date(post.scheduled_for)
      const time = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
      const titleOrCategory = post.title || post.category || 'post'
      const result = await sendWhatsAppTemplate(templateName, [titleOrCategory, time, post.post_type])
      if (result.ok) {
        await sql`UPDATE social_posts SET reminder_sent = true WHERE id = ${post.id}`
        sent++
      } else {
        errors.push(`#${post.id}: ${result.error}`)
      }
    }

    return NextResponse.json({ ok: true, sent, total: items.length, errors })
  } catch (err) {
    console.error('cron/whatsapp-post-reminder error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
