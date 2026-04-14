import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (new URL(request.url).searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }
  try {
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS mollie_payment_id VARCHAR(50)`
    await sql`ALTER TABLE diy_rentals ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'open'`
    return NextResponse.json({ ok: true, message: 'Mollie kolommen toegevoegd aan diy_rentals' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
