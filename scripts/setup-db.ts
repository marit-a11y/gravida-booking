/**
 * Run with: npm run setup-db
 * Requires POSTGRES_URL in .env.local
 */
import { sql } from '@vercel/postgres'

async function main() {
  console.log('Database tabellen aanmaken...')

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
  console.log('✓ availability tabel aangemaakt')

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
  console.log('✓ bookings tabel aangemaakt')

  await sql`
    CREATE TABLE IF NOT EXISTS customer_counter (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_number INTEGER NOT NULL DEFAULT 999
    )
  `

  await sql`
    INSERT INTO customer_counter (id, last_number)
    VALUES (1, 999)
    ON CONFLICT DO NOTHING
  `
  console.log('✓ customer_counter tabel aangemaakt')

  console.log('\nDatabase klaar voor gebruik!')
  process.exit(0)
}

main().catch((err) => {
  console.error('Setup mislukt:', err)
  process.exit(1)
})
