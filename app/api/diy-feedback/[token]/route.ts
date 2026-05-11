import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createGiftCard } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const r = await sql`
      SELECT id, first_name, last_name, email, scanner_issues, deposit_choice,
             feedback_submitted_at::text
      FROM diy_rentals WHERE feedback_token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json({ rental: r.rows[0] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await request.json()
    const { scanner_issues, deposit_choice } = body as {
      scanner_issues?: string
      deposit_choice: 'order_credit' | 'giftcard'
    }

    if (!deposit_choice || !['order_credit', 'giftcard'].includes(deposit_choice)) {
      return NextResponse.json({ error: 'Maak een keuze voor je aanbetaling.' }, { status: 400 })
    }

    // Find rental
    const r = await sql`
      SELECT id, first_name, last_name, email
      FROM diy_rentals WHERE feedback_token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const rental = r.rows[0]

    // Als keuze 'giftcard': maak een draft cadeaubon van EUR 100
    // (Marit/Laila stort dan andere EUR 100 terug en activeert de bon handmatig)
    let giftCardId: number | null = null
    if (deposit_choice === 'giftcard') {
      const giftcard = await createGiftCard({
        type: 'digitaal',
        value_euros: 100,
        purchaser_name: `${rental.first_name} ${rental.last_name}`,
        purchaser_email: rental.email,
        recipient_name: `${rental.first_name} ${rental.last_name}`,
        recipient_email: rental.email,
        personal_message: 'Aangemaakt vanuit DIY borgverrekening.',
        status: 'concept',  // moet nog goedgekeurd/geactiveerd worden door team
      }).catch(err => { console.error('Auto-giftcard create error:', err); return null })
      giftCardId = giftcard?.id ?? null
    }

    await sql`
      UPDATE diy_rentals SET
        scanner_issues = ${scanner_issues?.trim() || null},
        deposit_choice = ${deposit_choice},
        giftcard_id = ${giftCardId},
        feedback_submitted_at = NOW()
      WHERE feedback_token = ${params.token}
    `

    // Inbox notify
    const choiceLabel: Record<string, string> = {
      order_credit: 'volledig verrekenen met beeldje-bestelling (200 euro korting)',
      giftcard: 'cadeaubon 100 euro (draft aangemaakt) + 100 euro borg terugstorten',
    }
    for (const recipient of ['Marit', 'Laila']) {
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link)
        VALUES (
          ${recipient},
          'diy_feedback',
          ${'DIY feedback van ' + rental.first_name + ' ' + rental.last_name},
          ${'Borg-keuze: ' + choiceLabel[deposit_choice] + (scanner_issues ? '\n\nBijzonderheden: ' + scanner_issues : '')},
          '/admin/diy-scanners'
        )
      `.catch(err => console.error('Inbox notify error (diy feedback):', err))
    }

    return NextResponse.json({ ok: true, giftcard_id: giftCardId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Opslaan mislukt: ' + msg }, { status: 500 })
  }
}
