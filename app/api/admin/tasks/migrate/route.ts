import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        summary VARCHAR(300) NOT NULL,
        description TEXT,
        type VARCHAR(30) NOT NULL DEFAULT 'bug',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        assigned_by VARCHAR(50),
        due_date DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    return NextResponse.json({ ok: true, message: 'Tasks tabel klaar' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
