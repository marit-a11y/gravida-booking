import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Loopt elke vrijdag om Laila te herinneren contact op te nemen met
 * klanten die momenteel de DIY scanner in gebruik hebben (status = verzonden,
 * rental_week deze week) en waarmee nog geen contact is gemarkeerd.
 *
 * Maakt een inbox-item per rental in Laila's inbox.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Rentals waarvan rental_week deze week is (maandag) en status = verzonden
    // én nog geen contact is gehad.
    const r = await sql<{
      id: number; first_name: string; last_name: string; phone: string; email: string; customer_number: string | null
    }>`
      SELECT id, first_name, last_name, phone, email, customer_number
      FROM diy_rentals
      WHERE rental_week::date = date_trunc('week', NOW())::date
        AND status = 'verzonden'
        AND customer_contacted_at IS NULL
    `

    let notified = 0
    for (const rental of r.rows) {
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link, related_task_id)
        VALUES (
          'Laila',
          'diy_check_in',
          ${'Check-in: ' + rental.first_name + ' ' + rental.last_name + ' heeft scanner deze week'},
          ${'Even contact zoeken om te checken of de scanner goed is aangekomen en alles naar wens is. Telefoon: ' + rental.phone + '. E-mail: ' + rental.email + (rental.customer_number ? ' Klantnr: ' + rental.customer_number : '') + '. Markeer in admin als contact al is geweest om deze herinnering te onderdrukken.'},
          ${'/admin/diy-scanners'},
          NULL
        )
      `.catch(err => console.error('Inbox notify error (diy check-in):', err))
      notified++
    }

    return NextResponse.json({ ok: true, notified, total: r.rows.length })
  } catch (err) {
    console.error('cron/diy-check-in-reminder error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
