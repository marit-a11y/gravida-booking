import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const r = await sql`
      SELECT id, date_from::text, date_to::text, reason, created_at::text
      FROM diy_blocks
      ORDER BY date_from ASC
    `
    return NextResponse.json({ blocks: r.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date_from, date_to, reason } = body
    if (!date_from || !date_to) {
      return NextResponse.json({ error: 'date_from en date_to verplicht' }, { status: 400 })
    }
    if (date_from > date_to) {
      return NextResponse.json({ error: 'date_from moet vóór date_to liggen' }, { status: 400 })
    }
    const r = await sql`
      INSERT INTO diy_blocks (date_from, date_to, reason)
      VALUES (${date_from}::date, ${date_to}::date, ${reason ?? null})
      RETURNING id, date_from::text, date_to::text, reason, created_at::text
    `
    return NextResponse.json({ block: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + String(err) }, { status: 500 })
  }
}
