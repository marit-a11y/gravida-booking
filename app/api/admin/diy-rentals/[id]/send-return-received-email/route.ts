import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendDiyRentalReturnReceivedEmail } from '@/lib/email'
import { getRecipientsForPage } from '@/lib/inbox-recipients'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const { scanner_defect, send_email = true, update_status = true } = body as {
      scanner_defect?: string | null
      send_email?: boolean
      update_status?: boolean
    }

    const r = await sql`SELECT id, first_name, last_name, email, status, language FROM diy_rentals WHERE id = ${id} LIMIT 1`
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const rental = r.rows[0]

    // Opslaan: defect en retour-tijdstip, optioneel status
    if (update_status) {
      await sql`
        UPDATE diy_rentals SET
          scanner_defect = ${scanner_defect?.trim() || null},
          return_received_at = NOW(),
          status = CASE WHEN status NOT IN ('uitzoeken', 'scans_uitgezocht', 'geannuleerd') THEN 'retour' ELSE status END
        WHERE id = ${id}
      `
    } else {
      await sql`
        UPDATE diy_rentals SET
          scanner_defect = ${scanner_defect?.trim() || null}
        WHERE id = ${id}
      `
    }

    if (send_email && rental.email) {
      await sendDiyRentalReturnReceivedEmail({
        first_name: rental.first_name,
        language: rental.language,
        email: rental.email,
      })
    }

    // Inbox-notificatie bij defect: Laila / diy-beoordeling team moet klant benaderen
    if (scanner_defect && scanner_defect.trim()) {
      const recipients = await getRecipientsForPage('diy-beoordeling')
      const customerName = `${rental.first_name ?? ''} ${rental.last_name ?? ''}`.trim()
      const defectText = scanner_defect.trim().slice(0, 400)
      for (const recipient of recipients) {
        await sql`
          INSERT INTO inbox_items (recipient, sender, type, title, body, link)
          VALUES (
            ${recipient},
            'Vincent',
            'diy_defect',
            ${'⚠ Defect bij retour: ' + customerName},
            ${'Vincent vond bij ontvangst: ' + defectText + '\n\nGraag contact opnemen met de klant voor verdere afhandeling.'},
            '/admin/diy-scanners'
          )
        `.catch(err => console.error('Inbox notify error (diy defect):', err))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Mislukt: ' + msg }, { status: 500 })
  }
}
