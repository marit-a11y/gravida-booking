import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import { sendDiyCheckInEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Twee modi (?stage=morning of ?stage=afternoon, default morning):
 *
 * - morning: vrijdagochtend verstuurt automatisch een check-in mail
 *   naar klanten met scanner deze week. Klant kan via 2 knoppen
 *   reageren ('alles werkt' of 'ik heb een vraag').
 *
 * - afternoon: vrijdagmiddag check welke klanten nog niet hebben
 *   gereageerd en geen contact is gemarkeerd; voor die rentals
 *   maakt een inbox-item in Laila's inbox aan.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage') ?? 'morning'

  try {
    if (stage === 'morning') {
      // Stuur check-in mail naar actieve rentals zonder eerdere mail
      const r = await sql<{
        id: number; first_name: string; email: string; check_in_token: string | null
      }>`
        SELECT id, first_name, email, check_in_token
        FROM diy_rentals
        WHERE rental_week::date = date_trunc('week', NOW())::date
          AND status = 'verzonden'
          AND check_in_email_sent_at IS NULL
          AND customer_contacted_at IS NULL
      `
      let sent = 0
      for (const rental of r.rows) {
        const token = rental.check_in_token || crypto.randomBytes(20).toString('hex')
        try {
          await sendDiyCheckInEmail({
            first_name: rental.first_name,
            email: rental.email,
            token,
          })
          await sql`
            UPDATE diy_rentals SET
              check_in_token = ${token},
              check_in_email_sent_at = NOW()
            WHERE id = ${rental.id}
          `
          sent++
        } catch (err) {
          console.error(`Failed check-in mail for rental ${rental.id}:`, err)
        }
      }
      return NextResponse.json({ ok: true, stage: 'morning', sent, total: r.rows.length })
    }

    if (stage === 'afternoon') {
      // Non-responders: mail al gestuurd, geen response, geen contact gemarkeerd
      const r = await sql<{
        id: number; first_name: string; last_name: string; phone: string; email: string; customer_number: string | null
      }>`
        SELECT id, first_name, last_name, phone, email, customer_number
        FROM diy_rentals
        WHERE rental_week::date = date_trunc('week', NOW())::date
          AND status = 'verzonden'
          AND check_in_email_sent_at IS NOT NULL
          AND check_in_response IS NULL
          AND customer_contacted_at IS NULL
      `
      let notified = 0
      for (const rental of r.rows) {
        await sql`
          INSERT INTO inbox_items (recipient, type, title, body, link)
          VALUES (
            'Laila',
            'diy_check_in',
            ${'Klant reageert niet op check-in: ' + rental.first_name + ' ' + rental.last_name},
            ${'De check-in mail is verstuurd maar er is nog geen reactie. Even bellen of appen om te controleren of alles goed loopt. Telefoon: ' + rental.phone + ', e-mail: ' + rental.email + (rental.customer_number ? ', klantnr: ' + rental.customer_number : '') + '. Markeer daarna in admin "contact gehad" om dit op te lossen.'},
            '/admin/diy-scanners'
          )
        `.catch(err => console.error('Inbox notify error (diy check-in afternoon):', err))
        notified++
      }
      return NextResponse.json({ ok: true, stage: 'afternoon', notified, total: r.rows.length })
    }

    return NextResponse.json({ error: 'Unknown stage' }, { status: 400 })
  } catch (err) {
    console.error('cron/diy-check-in-reminder error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
