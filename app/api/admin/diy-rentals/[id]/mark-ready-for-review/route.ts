import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getRecipientsForPage } from '@/lib/inbox-recipients'

export const dynamic = 'force-dynamic'

/**
 * Markeer een DIY rental als 'klaar voor scan-beoordeling' nadat Vincent
 * de ruwe STL bestanden heeft geüpload. Zet status op 'uitzoeken' (mits niet
 * al verder in flow) en stuurt een inbox-notif naar iedereen met
 * diy-beoordeling toegang.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const r = await sql`
      SELECT id, first_name, last_name, customer_number, status FROM diy_rentals WHERE id = ${id}
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const rental = r.rows[0]

    // Aantal STL bestanden meetellen (zodat we ze in het bericht kunnen noemen)
    const fileCount = await sql`
      SELECT COUNT(*)::int AS c FROM diy_scan_files
      WHERE rental_id = ${id} AND deleted_at IS NULL
    `
    const count = fileCount.rows[0]?.c ?? 0

    // Zet status op uitzoeken indien het nog op retour staat
    await sql`
      UPDATE diy_rentals
      SET status = CASE WHEN status IN ('retour', 'verzonden', 'gereserveerd') THEN 'uitzoeken' ELSE status END
      WHERE id = ${id}
    `

    const recipients = await getRecipientsForPage('diy-beoordeling')
    const customerName = `${rental.first_name ?? ''} ${rental.last_name ?? ''}`.trim()
    const cn = rental.customer_number ? ` (${rental.customer_number})` : ''
    for (const recipient of recipients) {
      await sql`
        INSERT INTO inbox_items (recipient, sender, type, title, body, link)
        VALUES (
          ${recipient},
          'Vincent',
          'diy_ready_for_review',
          ${'📷 Scan klaar voor beoordeling: ' + customerName + cn},
          ${'Vincent heeft de ruwe scans geüpload (' + count + ' bestand' + (count === 1 ? '' : 'en') + '). De STL bestanden zijn te downloaden via Scan beoordeling.'},
          '/admin/diy-beoordeling'
        )
      `.catch(err => console.error('Inbox notify error (ready for review):', err))
    }

    return NextResponse.json({ ok: true, file_count: count })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Mislukt: ' + msg }, { status: 500 })
  }
}
