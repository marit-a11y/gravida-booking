import { NextRequest, NextResponse } from 'next/server'
import { getDiyRentalById } from '@/lib/db'
import { sendDiyRentalUpdateEmail, sendDiyRentalUpdateStaffEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const rental = await getDiyRentalById(id)
    if (!rental) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })

    // Customer mail
    await sendDiyRentalUpdateEmail({
      first_name: rental.first_name,
      email: rental.email,
      rental_week: rental.rental_week,
      customer_number: rental.customer_number,
    })

    // Staff mail
    await sendDiyRentalUpdateStaffEmail({
      first_name: rental.first_name,
      last_name: rental.last_name,
      email: rental.email,
      phone: rental.phone,
      rental_week: rental.rental_week,
      customer_number: rental.customer_number,
      address: rental.address,
      city: rental.city,
      zip_code: rental.zip_code,
    }).catch(err => console.error('DIY staff update mail error:', err))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/diy-rentals/[id]/send-update-email error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
