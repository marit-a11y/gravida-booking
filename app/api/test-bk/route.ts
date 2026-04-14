import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const to = searchParams.get('to')

  const hasKey = !!process.env.RESEND_API_KEY
  const keyPrefix = process.env.RESEND_API_KEY?.slice(0, 8) ?? '(niet ingesteld)'
  const from = process.env.EMAIL_FROM ?? '(niet ingesteld)'
  const staffEmail = process.env.STAFF_EMAIL ?? '(niet ingesteld)'

  if (!to) {
    return NextResponse.json({
      resend_key_set: hasKey,
      resend_key_prefix: keyPrefix,
      email_from: from,
      staff_email: staffEmail,
      usage: 'Voeg ?to=jouw@email.com toe om een testmail te sturen',
    })
  }

  if (!hasKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is niet ingesteld' }, { status: 500 })
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: from,
      to: to,
      subject: 'Gravida testmail',
      html: '<p>Dit is een testmail van het Gravida boekingssysteem.</p>',
    })
    return NextResponse.json({ ok: true, result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
