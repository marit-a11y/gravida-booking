import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { sendScanweekConfirmEmail } from '@/lib/email'
import { reminderDate } from '@/lib/scanweek'

export const dynamic = 'force-dynamic'

// CORS zodat het website-formulier (gravida.nl / gravida-new) hierheen kan posten
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email ?? '').toString().trim().toLowerCase()
    const name = (body.name ?? '').toString().trim() || null
    const region = (body.region ?? '').toString().trim() || null
    // current_week: zwangerschapsweek nu (int). Accepteer ook 'week' of 'current_week'
    const rawWeek = body.current_week ?? body.week ?? body.weeks ?? null
    const currentWeek = rawWeek != null ? parseInt(String(rawWeek).replace(/\D/g, ''), 10) : null

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Geldig e-mailadres verplicht' }, { status: 400, headers: corsHeaders() })
    }
    if (currentWeek == null || isNaN(currentWeek) || currentWeek < 1 || currentWeek > 42) {
      return NextResponse.json({ error: 'Geldige zwangerschapsweek verplicht' }, { status: 400, headers: corsHeaders() })
    }

    const today = new Date().toISOString().slice(0, 10)

    // Dedup: zelfde e-mail op dezelfde dag → niets dubbels
    const existing = await sql`
      SELECT id FROM scanweek_signups WHERE email = ${email} AND signup_week_date = ${today}::date LIMIT 1
    `
    if (existing.rows.length > 0) {
      return NextResponse.json({ ok: true, deduped: true }, { headers: corsHeaders() })
    }

    const ins = await sql`
      INSERT INTO scanweek_signups (email, name, current_week, signup_week_date, region, source)
      VALUES (${email}, ${name}, ${currentWeek}, ${today}::date, ${region}, 'website')
      RETURNING id
    `
    const id = ins.rows[0].id

    // Bevestigingsmail met de berekende reminderdatum (niet-blokkerend)
    const rd = reminderDate(currentWeek, today)
    sendScanweekConfirmEmail({ email, name, reminder_date: rd })
      .then(() => sql`UPDATE scanweek_signups SET confirm_sent_at = NOW() WHERE id = ${id}`)
      .catch(err => console.error('scanweek confirm mail error:', err))

    return NextResponse.json({ ok: true, reminder_date: rd }, { headers: corsHeaders() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500, headers: corsHeaders() })
  }
}
