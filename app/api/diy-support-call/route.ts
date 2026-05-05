import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getDiyRentalById } from '@/lib/db'
import { sendDiySupportCallStaffEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rental_id, message, preferred_time } = body
    const id = parseInt(String(rental_id), 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const rental = await getDiyRentalById(id)
    if (!rental) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })

    const fullMessage = [
      preferred_time ? `Voorkeur tijdstip: ${preferred_time}` : '',
      message?.trim() || '',
    ].filter(Boolean).join('\n\n')

    await sql`
      UPDATE diy_rentals
      SET support_call_requested_at = NOW(),
          support_call_message = ${fullMessage || null}
      WHERE id = ${id}
    `

    // Notify staff (non-blocking — don't fail the user-facing request if mail fails)
    sendDiySupportCallStaffEmail({
      first_name: rental.first_name,
      last_name: rental.last_name,
      email: rental.email,
      phone: rental.phone,
      customer_number: rental.customer_number,
      message: fullMessage,
      rental_id: id,
    }).catch(err => console.error('Support call staff mail error:', err))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/diy-support-call error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Aanvraag mislukt: ' + msg }, { status: 500 })
  }
}
