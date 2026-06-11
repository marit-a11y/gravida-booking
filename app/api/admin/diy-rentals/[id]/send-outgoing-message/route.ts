import { NextRequest, NextResponse } from 'next/server'
import { getDiyRentalById } from '@/lib/db'
import { sendDiyOutgoingMessageEmail, type DiyOutgoingMessageType } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const body = await request.json()
    const message_type = body.message_type as DiyOutgoingMessageType
    if (!['not_charged', 'delayed', 'defect', 'other'].includes(message_type)) {
      return NextResponse.json({ error: 'Ongeldig message_type' }, { status: 400 })
    }

    const rental = await getDiyRentalById(id)
    if (!rental) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })

    await sendDiyOutgoingMessageEmail({
      first_name: rental.first_name,
      language: rental.language,
      email: rental.email,
      message_type,
      reason: body.reason ?? null,
      new_send_date: body.new_send_date ?? null,
      new_return_date: body.new_return_date ?? null,
      custom_text: body.custom_text ?? null,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST send-outgoing-message error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
