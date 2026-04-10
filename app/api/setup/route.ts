import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')

  const setupKey = process.env.SETUP_KEY
  if (!setupKey || key !== setupKey) {
    return NextResponse.json({ error: 'Ongeldige setup sleutel' }, { status: 403 })
  }

  try {
    // Create availability table
    await sql`
      CREATE TABLE IF NOT EXISTS availability (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        region VARCHAR(200) NOT NULL,
        slots JSONB NOT NULL DEFAULT '[]',
        max_per_slot INTEGER NOT NULL DEFAULT 2,
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Create bookings table
    await sql`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        customer_number VARCHAR(4) NOT NULL UNIQUE,
        availability_id INTEGER REFERENCES availability(id),
        time_slot VARCHAR(10) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(200) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        address TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        zip_code VARCHAR(10) NOT NULL,
        pregnancy_weeks INTEGER,
        notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'bevestigd',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Create customer counter table
    await sql`
      CREATE TABLE IF NOT EXISTS customer_counter (
        id INTEGER PRIMARY KEY DEFAULT 1,
        last_number INTEGER NOT NULL DEFAULT 999
      )
    `

    // Seed the counter if not exists
    await sql`
      INSERT INTO customer_counter (id, last_number)
      VALUES (1, 999)
      ON CONFLICT DO NOTHING
    `

    return NextResponse.json({
      success: true,
      message: 'Database tabellen aangemaakt. Verwijder de SETUP_KEY uit je omgevingsvariabelen.',
    })
  } catch (err) {
    console.error('Setup error:', err)
    return NextResponse.json(
      { error: 'Database setup mislukt', details: String(err) },
      { status: 500 }
    )
  }
}
