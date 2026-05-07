import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendScanConsentEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    // Fetch consent + linked booking/rental for klant info
    const c = await sql`SELECT * FROM scan_consents WHERE id = ${id} LIMIT 1`
    if (c.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const consent = c.rows[0]

    let firstName: string | null = null
    let email: string | null = null
    if (consent.booking_id) {
      const b = await sql`SELECT first_name, email FROM bookings WHERE id = ${consent.booking_id} LIMIT 1`
      if (b.rows[0]) { firstName = b.rows[0].first_name; email = b.rows[0].email }
    } else if (consent.diy_rental_id) {
      const r = await sql`SELECT first_name, email FROM diy_rentals WHERE id = ${consent.diy_rental_id} LIMIT 1`
      if (r.rows[0]) { firstName = r.rows[0].first_name; email = r.rows[0].email }
    }
    if (!email) return NextResponse.json({ error: 'Geen e-mailadres gevonden bij koppeling' }, { status: 400 })

    await sendScanConsentEmail({
      first_name: firstName ?? '',
      email,
      token: consent.token,
      material: consent.material,
      finish: consent.finish,
      size: consent.size,
      size_other: consent.size_other,
      with_arms: consent.with_arms,
      weighted: consent.weighted,
    })

    await sql`UPDATE scan_consents SET sent_at = NOW(), updated_at = NOW() WHERE id = ${id}`

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('send scan consent email error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
