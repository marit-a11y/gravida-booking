import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import { sendDiyFeedbackEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const r = await sql`
      SELECT id, first_name, email, feedback_token FROM diy_rentals WHERE id = ${id} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const rental = r.rows[0]
    const token = rental.feedback_token ?? crypto.randomBytes(20).toString('hex')

    if (!rental.feedback_token) {
      await sql`UPDATE diy_rentals SET feedback_token = ${token} WHERE id = ${id}`
    }

    await sendDiyFeedbackEmail({
      first_name: rental.first_name,
      email: rental.email,
      token,
    })

    await sql`UPDATE diy_rentals SET feedback_sent_at = NOW() WHERE id = ${id}`

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
