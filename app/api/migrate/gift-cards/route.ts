import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  const setupKey = process.env.SETUP_KEY
  if (!setupKey || key !== setupKey) {
    return NextResponse.json({ error: 'Ongeldige setup sleutel' }, { status: 403 })
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS gift_cards (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'digitaal',
        value_euros DECIMAL(10,2) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'wacht_op_betaling',
        purchaser_name VARCHAR(255) NOT NULL,
        purchaser_email VARCHAR(255) NOT NULL,
        recipient_name VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        personal_message TEXT,
        mollie_payment_id VARCHAR(100),
        redeemed_at TIMESTAMPTZ,
        redeemed_by_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON gift_cards(code)`
    await sql`CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON gift_cards(status)`
    await sql`CREATE INDEX IF NOT EXISTS gift_cards_purchaser_email_idx ON gift_cards(purchaser_email)`

    return NextResponse.json({
      success: true,
      message: 'Tabel gift_cards aangemaakt.',
    })
  } catch (err) {
    console.error('Gift cards migration error:', err)
    return NextResponse.json(
      { error: 'Migratie mislukt', details: String(err) },
      { status: 500 }
    )
  }
}
