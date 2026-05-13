import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { updateDiyRental, getDiyRentalById } from '@/lib/db'
import { getMollie } from '@/lib/mollie'
import { sendDiyRentalReturnReceivedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()

    // If deposit_status is changing to 'teruggestort', trigger Mollie refund
    if (body.deposit_status === 'teruggestort') {
      const existing = await getDiyRentalById(id)
      if (existing?.mollie_payment_id && existing.payment_status === 'betaald') {
        try {
          const mollieClient = getMollie()
          await mollieClient.paymentRefunds.create({
            paymentId: existing.mollie_payment_id,
            amount: { currency: 'EUR', value: '200.00' },
            description: `Borg terugstorting DIY scan kit — ${existing.first_name} ${existing.last_name}`,
          })
          body.payment_status = 'teruggestort'
        } catch (refundErr) {
          console.error('Mollie refund error:', refundErr)
          return NextResponse.json({ error: 'Mollie refund mislukt. Controleer het Mollie dashboard.' }, { status: 500 })
        }
      }
    }

    // Auto-trigger "scanner ontvangen" mail bij eerste status-wijziging naar 'retour'
    let triggerReturnMail = false
    if (body.status === 'retour') {
      const existing = await getDiyRentalById(id)
      if (existing && existing.status !== 'retour') {
        // Voorkom dubbele mail
        const r = await sql`SELECT return_received_at FROM diy_rentals WHERE id = ${id}`
        if (!r.rows[0]?.return_received_at) triggerReturnMail = true
      }
    }

    const rental = await updateDiyRental(id, body)
    if (!rental) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })

    if (triggerReturnMail) {
      try {
        await sendDiyRentalReturnReceivedEmail({
          first_name: rental.first_name,
          email: rental.email,
        })
        await sql`UPDATE diy_rentals SET return_received_at = NOW() WHERE id = ${id}`
      } catch (mailErr) {
        console.error('Auto-trigger retour mail mislukt:', mailErr)
      }
    }

    return NextResponse.json(rental)
  } catch (err) {
    console.error('PUT /api/admin/diy-rentals/[id] error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Bijwerken mislukt: ' + msg }, { status: 500 })
  }
}
