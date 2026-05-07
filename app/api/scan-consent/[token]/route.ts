import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// GET: fetch consent by token (publiek, voor het invullen)
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const r = await sql`
      SELECT id, token, material, finish, size, size_other, with_arms, weighted,
             consent_storage_files, consent_marketing_use, shipping_insured,
             digital_wishes, shared_notes, submitted_at::text
      FROM scan_consents WHERE token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    // Get klantnaam ook
    const consent = r.rows[0]
    const c = await sql`SELECT booking_id, diy_rental_id FROM scan_consents WHERE token = ${params.token} LIMIT 1`
    let firstName: string | null = null
    if (c.rows[0]?.booking_id) {
      const b = await sql`SELECT first_name FROM bookings WHERE id = ${c.rows[0].booking_id}`
      firstName = b.rows[0]?.first_name ?? null
    } else if (c.rows[0]?.diy_rental_id) {
      const x = await sql`SELECT first_name FROM diy_rentals WHERE id = ${c.rows[0].diy_rental_id}`
      firstName = x.rows[0]?.first_name ?? null
    }

    return NextResponse.json({ consent, first_name: firstName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: klant submit antwoorden
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json()
    const {
      consent_storage_files,
      consent_marketing_use,
      shipping_insured,
      digital_wishes,
      shared_notes,
    } = body

    const r = await sql`
      UPDATE scan_consents SET
        consent_storage_files = ${consent_storage_files ?? null},
        consent_marketing_use = ${consent_marketing_use ?? null},
        shipping_insured = ${shipping_insured ?? null},
        digital_wishes = ${digital_wishes ?? null},
        shared_notes = ${shared_notes ?? null},
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE token = ${params.token}
      RETURNING id, booking_id, diy_rental_id
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const consentRow = r.rows[0]
    // Inbox notify Marit + Laila
    const klantNaam = await (async () => {
      if (consentRow.booking_id) {
        const b = await sql`SELECT first_name, last_name FROM bookings WHERE id = ${consentRow.booking_id}`
        return b.rows[0] ? `${b.rows[0].first_name} ${b.rows[0].last_name}` : 'klant'
      }
      if (consentRow.diy_rental_id) {
        const x = await sql`SELECT first_name, last_name FROM diy_rentals WHERE id = ${consentRow.diy_rental_id}`
        return x.rows[0] ? `${x.rows[0].first_name} ${x.rows[0].last_name}` : 'klant'
      }
      return 'klant'
    })()

    for (const recipient of ['Marit', 'Laila']) {
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link)
        VALUES (
          ${recipient},
          'consent_submitted',
          ${'📝 Toestemmingsformulier ingevuld door ' + klantNaam},
          ${'De klant heeft het toestemmingsformulier ingevuld. Bekijk de antwoorden in het beheer.'},
          ${consentRow.booking_id ? '/admin/boekingen' : '/admin/diy-scanners'}
        )
      `.catch(err => console.error('Inbox notify error (consent submit):', err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Opslaan mislukt: ' + msg }, { status: 500 })
  }
}
