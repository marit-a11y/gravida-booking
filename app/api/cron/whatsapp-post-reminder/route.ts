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
 * within the next 15 minutes — alleen voor posts die op status 'klaargezet'
 * staan (= door Sonja actief gemarkeerd als klaar om te plaatsen).
 *
 * Drafts en al-geplaatst worden overgeslagen. Dat scheelt veel onnodige
 * meldingen.
 *
 * IDEMPOTENT: we eerst atomair `reminder_sent = true` zetten en de geclaimde
 * rijen teruggeven. Daarna sturen we WhatsApp. Zo kan dezelfde post nooit
 * twee keer worden gereminded.
 *
 * ZELFHERSTELLEND: lukt het versturen NIET (bv. verlopen WhatsApp-token),
 * dan geven we de claim weer vrij (`reminder_sent = false`) zodat de melding
 * niet stilletjes verloren gaat en de volgende run het opnieuw probeert.
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
    // Atomair claimen: markeer als reminded EN geef de rijen terug.
    // Alleen 'klaargezet' (door Sonja gemarkeerd als klaar om te plaatsen).
    const claimed = await sql<DuePost>`
      UPDATE social_posts
      SET reminder_sent = true
      WHERE id IN (
        SELECT id FROM social_posts
        WHERE scheduled_for >= NOW()
          AND scheduled_for <= NOW() + INTERVAL '15 minutes'
          AND status = 'klaargezet'
          AND reminder_sent = false
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, scheduled_for::text, title, category, post_type
    `

    const items = claimed.rows
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
      const result = await sendWhatsAppTemplate(
        templateName,
        [titleOrCategory, time, post.post_type],
        'nl',
        undefined,
        String(post.id),
      )
      if (result.ok) {
        sent++
      } else {
        errors.push(`#${post.id}: ${result.error}`)
        // Versturen mislukt: claim teruggeven zodat de melding niet verloren
        // gaat en een volgende run het opnieuw probeert (bv. na token-refresh).
        console.error(`WhatsApp post-reminder mislukt voor #${post.id}, claim vrijgegeven:`, result.error)
        await sql`UPDATE social_posts SET reminder_sent = false WHERE id = ${post.id}`
          .catch(e => console.error(`Kon claim niet vrijgeven voor #${post.id}:`, e))
      }
    }

    return NextResponse.json({ ok: true, sent, failed: errors.length, total: items.length, errors })
  } catch (err) {
    console.error('cron/whatsapp-post-reminder error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
