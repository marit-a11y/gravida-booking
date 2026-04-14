import { NextRequest, NextResponse } from 'next/server'
import { updateDiyRental, getDiyRentalById } from '@/lib/db'
import { getMollie } from '@/lib/mollie'

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

    const rental = await updateDiyRental(id, body)
    if (!rental) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })
    return NextResponse.json(rental)
  } catch (err) {
    console.error('PUT /api/admin/diy-rentals/[id] error:', err)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}
