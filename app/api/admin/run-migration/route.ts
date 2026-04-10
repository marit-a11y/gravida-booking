import { sql } from '@vercel/postgres'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await sql`ALTER TABLE availability ADD COLUMN IF NOT EXISTS group_id UUID DEFAULT NULL`
    await sql`ALTER TABLE availability ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT false`
    await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false`
    return NextResponse.json({ ok: true, message: 'Migration complete' })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
