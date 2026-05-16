import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const response = body.response as 'ok' | 'question' | undefined
    const question: string | null = body.question?.trim() || null
    if (!response || !['ok', 'question'].includes(response)) {
      return NextResponse.json({ error: 'Ongeldige response' }, { status: 400 })
    }

    const r = await sql<{ id: number; first_name: string; last_name: string; phone: string; email: string }>`
      SELECT id, first_name, last_name, phone, email
      FROM diy_rentals WHERE check_in_token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const rental = r.rows[0]

    // Sla response op. Als 'ok' => markeer contact gehad (geen reminder meer).
    if (response === 'ok') {
      await sql`
        UPDATE diy_rentals SET
          check_in_response = 'ok',
          check_in_responded_at = NOW(),
          customer_contacted_at = NOW(),
          customer_contacted_by = 'klant via check-in',
          customer_contact_note = 'Klant gaf zelf aan: alles werkt prima'
        WHERE id = ${rental.id}
      `
    } else {
      await sql`
        UPDATE diy_rentals SET
          check_in_response = 'question',
          check_in_responded_at = NOW(),
          check_in_question = ${question}
        WHERE id = ${rental.id}
      `
      // Direct inbox-item voor Laila
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link)
        VALUES (
          'Laila',
          'diy_check_in_question',
          ${'Klant heeft een vraag: ' + rental.first_name + ' ' + rental.last_name},
          ${(question ? 'Vraag: ' + question + '\n\n' : '') + 'Bel of app even: ' + rental.phone + ' / ' + rental.email},
          '/admin/diy-scanners'
        )
      `.catch(err => console.error('Inbox notify error (check-in question):', err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verwerken mislukt: ' + msg }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const r = await sql<{ first_name: string; check_in_response: string | null }>`
    SELECT first_name, check_in_response FROM diy_rentals WHERE check_in_token = ${params.token} LIMIT 1
  `
  if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  return NextResponse.json({ rental: r.rows[0] })
}
