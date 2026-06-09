import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// GET: alle scanweek-aanmeldingen (native)
export async function GET() {
  try {
    const r = await sql`
      SELECT id, email, name, current_week, signup_week_date::text, region, status, note,
             confirm_sent_at::text, reminder_sent_at::text, created_at::text
      FROM scanweek_signups
      ORDER BY created_at DESC
    `
    return NextResponse.json({ signups: r.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH: status / notitie bijwerken
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, note } = body
    if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
    if (status && !['pending', 'contacted', 'booked', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
    }
    await sql`
      UPDATE scanweek_signups
      SET status = COALESCE(${status ?? null}, status),
          note = COALESCE(${note ?? null}, note),
          updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
