import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getDiyRentalById } from '@/lib/db'
import { sendDiyRentalEmails } from '@/lib/email'

export const dynamic = 'force-dynamic'

/**
 * Handmatig een DIY reservering markeren als betaald — voor gevallen
 * waarin Mollie (test of live) de betaling niet correct heeft afgerond.
 * Effect: payment_status='betaald', status='gereserveerd'.
 * Optioneel: ook de bevestigingsmail opnieuw versturen.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const sendConfirmation: boolean = body.send_confirmation !== false  // default true

    const existing = await getDiyRentalById(id)
    if (!existing) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })

    await sql`
      UPDATE diy_rentals SET
        payment_status = 'betaald',
        status = CASE WHEN status = 'wacht_op_betaling' THEN 'gereserveerd' ELSE status END
      WHERE id = ${id}
    `

    if (sendConfirmation) {
      sendDiyRentalEmails({
        customer_number: existing.customer_number,
        first_name: existing.first_name,
        last_name: existing.last_name,
        email: existing.email,
        phone: existing.phone,
        address: existing.address,
        city: existing.city,
        zip_code: existing.zip_code,
        rental_week: existing.rental_week,
      }).catch(err => console.error('Bevestigingsmail na manual mark-paid mislukt:', err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/diy-rentals/[id]/mark-paid error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Markeren mislukt: ' + msg }, { status: 500 })
  }
}
