import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendSocialPlannerReminder, SocialReminderItem } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find posts scheduled for today that haven't had a reminder sent yet
    const result = await sql<SocialReminderItem>`
      SELECT id, scheduled_for::text, platform, post_type, caption, image_urls, canva_url
      FROM social_posts
      WHERE scheduled_for::date = CURRENT_DATE
        AND status = 'scheduled'
        AND reminder_sent = false
      ORDER BY scheduled_for ASC
    `
    const items = result.rows
    if (items.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'Geen posts voor vandaag' })
    }

    await sendSocialPlannerReminder(items)

    // Mark as reminder_sent (one query per id — small list)
    for (const it of items) {
      await sql`UPDATE social_posts SET reminder_sent = true WHERE id = ${it.id}`
    }

    return NextResponse.json({ ok: true, sent: items.length })
  } catch (err) {
    console.error('cron/social-reminders error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
