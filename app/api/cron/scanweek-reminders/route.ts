import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendScanweekReminderEmail } from '@/lib/email'
import { currentPregnancyWeek, REMINDER_WEEK } from '@/lib/scanweek'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Dagelijkse cron: stuur de scanweek-reminder naar iedereen die rond week 30
 * (REMINDER_WEEK) zit en nog geen reminder kreeg. Idempotent via reminder_sent_at.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const rows = await sql<{ id: number; email: string; name: string | null; current_week: number; signup_week_date: string }>`
      SELECT id, email, name, current_week, signup_week_date::text
      FROM scanweek_signups
      WHERE status = 'pending'
        AND reminder_sent_at IS NULL
        AND current_week IS NOT NULL
    `
    const now = new Date()
    let sent = 0
    const errors: string[] = []

    for (const r of rows.rows) {
      const week = currentPregnancyWeek(r.current_week, r.signup_week_date, now)
      if (week < REMINDER_WEEK) continue   // nog niet aan de beurt
      if (week > 38) continue              // te laat, niet meer relevant (scan al voorbij/te laat)
      try {
        await sendScanweekReminderEmail({ email: r.email, name: r.name })
        await sql`UPDATE scanweek_signups SET reminder_sent_at = NOW(), status = 'contacted', updated_at = NOW() WHERE id = ${r.id}`
        sent++
      } catch (err) {
        errors.push(`#${r.id}: ${String(err)}`)
      }
    }
    return NextResponse.json({ ok: true, checked: rows.rows.length, sent, errors })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
