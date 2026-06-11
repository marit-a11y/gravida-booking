import { NextRequest, NextResponse } from 'next/server'
import { getDiyRentalById, updateDiyRental } from '@/lib/db'
import { sendDiyRentalShippedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const trackingUrl: string | null = body.tracking_url?.trim() || null
    const setStatus: boolean = body.set_status !== false  // default true

    const rental = await getDiyRentalById(id)
    if (!rental) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })

    // Update status naar 'verzonden' (tenzij bewust uitgezet)
    if (setStatus && rental.status !== 'verzonden') {
      await updateDiyRental(id, { status: 'verzonden' })
    }

    await sendDiyRentalShippedEmail({
      first_name: rental.first_name,
      language: rental.language,
      email: rental.email,
      rental_id: rental.id,
      customer_number: rental.customer_number,
      tracking_url: trackingUrl,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/admin/diy-rentals/[id]/send-shipped-email error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
