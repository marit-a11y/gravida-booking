import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendDiyRentalReturnReceivedEmail } from '@/lib/email'

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

    const r = await sql`SELECT id, first_name, email, status FROM diy_rentals WHERE id = ${id} LIMIT 1`
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
        email: rental.email,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Mislukt: ' + msg }, { status: 500 })
  }
}
