import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { updateDiyRentalPayment, getDiyRentalById } from '@/lib/db'
import { getMollie } from '@/lib/mollie'
import { sendDiyRentalEmails } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)
    const paymentId = params.get('id')

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 })
    }

    const mollieClient = getMollie()
    const payment = await mollieClient.payments.get(paymentId)
    const metadata = payment.metadata as Record<string, string> | null
    const rentalId = parseInt(metadata?.rental_id ?? '', 10)

    if (!rentalId) {
      console.error('Webhook: no rental_id in payment metadata', paymentId)
      return NextResponse.json({ ok: true })
    }

    if (payment.status === 'paid') {
      await updateDiyRentalPayment(rentalId, {
        payment_status: 'betaald',
        status: 'gereserveerd',
      })

      // Send confirmation emails
      const rental = await getDiyRentalById(rentalId)
      if (rental) {
        await sendDiyRentalEmails({
          customer_number: rental.customer_number,
          first_name: rental.first_name,
          last_name: rental.last_name,
          email: rental.email,
          phone: rental.phone,
          address: rental.address,
          city: rental.city,
          zip_code: rental.zip_code,
          rental_week: rental.rental_week,
        }).catch(err => console.error('sendDiyRentalEmails error:', err))
      }
    } else if (['failed', 'canceled', 'expired'].includes(payment.status)) {
      await updateDiyRentalPayment(rentalId, {
        payment_status: 'mislukt',
        status: 'geannuleerd',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/diy-rentals/webhook error:', err)
    return NextResponse.json({ error: 'Webhook verwerking mislukt' }, { status: 500 })
  }
}
