import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (new URL(request.url).searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS diy_scanners (
        id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL,
        is_available BOOLEAN NOT NULL DEFAULT true, notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS diy_rentals (
        id SERIAL PRIMARY KEY, scanner_id INTEGER REFERENCES diy_scanners(id),
        rental_week DATE NOT NULL, first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL, email VARCHAR(200) NOT NULL,
        phone VARCHAR(30) NOT NULL, address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL, zip_code VARCHAR(10) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'gereserveerd',
        deposit_amount INTEGER NOT NULL DEFAULT 200,
        deposit_status VARCHAR(20) NOT NULL DEFAULT 'ingehouden',
        notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    const existing = await sql`SELECT COUNT(*) as count FROM diy_scanners`
    let seeded = 0
    if (parseInt(existing.rows[0].count, 10) === 0) {
      await sql`INSERT INTO diy_scanners (name, is_available) VALUES ('Scanner A', true)`
      await sql`INSERT INTO diy_scanners (name, is_available, notes) VALUES ('Scanner B', false, 'Defect')`
      seeded = 2
    }
    return NextResponse.json({ ok: true, message: 'DIY tabellen aangemaakt', scanners_seeded: seeded })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
