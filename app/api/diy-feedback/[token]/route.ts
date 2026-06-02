import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const r = await sql`
      SELECT id, first_name, last_name, email, scanner_issues, scan_preference,
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
    const { scanner_issues, scan_preference } = body as {
      scanner_issues?: string
      scan_preference?: string
    }

    // Find rental
    const r = await sql`
      SELECT id, first_name, last_name
      FROM diy_rentals WHERE feedback_token = ${params.token} LIMIT 1
    `
    if (r.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const rental = r.rows[0]

    await sql`
      UPDATE diy_rentals SET
        scanner_issues = ${scanner_issues?.trim() || null},
        scan_preference = ${scan_preference?.trim() || null},
        feedback_submitted_at = NOW()
      WHERE feedback_token = ${params.token}
    `

    // Inbox-notif voor team: bijzonderheden / scan-voorkeur ingevuld
    const recipients = await (await import('@/lib/inbox-recipients')).getRecipientsForPage('diy-scanners')
    const bodyText = [
      scanner_issues ? `Bijzonderheden: ${scanner_issues}` : null,
      scan_preference ? `Scan-voorkeur: ${scan_preference}` : null,
    ].filter(Boolean).join('\n\n') || 'Geen bijzonderheden of voorkeur ingevuld.'
    for (const recipient of recipients) {
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link)
        VALUES (
          ${recipient},
          'diy_feedback',
          ${'DIY feedback van ' + rental.first_name + ' ' + rental.last_name},
          ${bodyText},
          '/admin/diy-scanners'
        )
      `.catch(err => console.error('Inbox notify error (diy feedback):', err))
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Opslaan mislukt: ' + msg }, { status: 500 })
  }
}
