import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = body.recipient
    if (!recipient) return NextResponse.json({ error: 'recipient verplicht' }, { status: 400 })
    const r = await sql`UPDATE inbox_items SET is_read = true WHERE recipient = ${recipient} AND is_read = false`
    return NextResponse.json({ ok: true, updated: r.rowCount ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
