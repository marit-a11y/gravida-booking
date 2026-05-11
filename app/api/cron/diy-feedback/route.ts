import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import { sendDiyFeedbackEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Runs Sunday evening (CRON: 0 19 * * 0 = 19:00 UTC = 21:00 NL summer / 20:00 winter).
 *
 * Stuurt een feedback + borg-keuze mail naar elke DIY-klant waarvan de
 * rental_week op maandag erna afloopt (dus retour-dag is morgen).
 *
 * Skipt rentals die geannuleerd zijn of waarvan de feedback-mail al
 * eerder verstuurd is.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Rentals waarvan retour-maandag morgen is = rental_week + 7 dagen = tomorrow
    // (rental_week = maandag start van de week, retour is maandag erna)
    const result = await sql<{
      id: number
      first_name: string
      email: string
    }>`
      SELECT id, first_name, email
      FROM diy_rentals
      WHERE rental_week::date + INTERVAL '7 days' = CURRENT_DATE + INTERVAL '1 day'
        AND status NOT IN ('geannuleerd', 'wacht_op_betaling')
        AND feedback_sent_at IS NULL
        AND email IS NOT NULL
    `

    let sent = 0
    const errors: string[] = []

    for (const r of result.rows) {
      try {
        // Token genereren als die er nog niet is
        const token = crypto.randomBytes(20).toString('hex')
        await sql`
          UPDATE diy_rentals
          SET feedback_token = COALESCE(feedback_token, ${token}),
              feedback_sent_at = NOW()
          WHERE id = ${r.id}
        `
        // Tokenized URL teruglezen (in geval er al eentje was)
        const tokenRow = await sql<{ feedback_token: string }>`
          SELECT feedback_token FROM diy_rentals WHERE id = ${r.id}
        `
        const actualToken = tokenRow.rows[0]?.feedback_token ?? token

        await sendDiyFeedbackEmail({
          first_name: r.first_name,
          email: r.email,
          token: actualToken,
        })
        sent++
      } catch (err) {
        errors.push(`Rental #${r.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({ ok: true, sent, total: result.rows.length, errors })
  } catch (err) {
    console.error('cron/diy-feedback error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
