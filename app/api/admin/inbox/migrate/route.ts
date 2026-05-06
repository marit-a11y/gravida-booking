import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS inbox_items (
        id SERIAL PRIMARY KEY,
        recipient VARCHAR(50) NOT NULL,
        sender VARCHAR(50),
        type VARCHAR(30) NOT NULL DEFAULT 'message',
        title VARCHAR(300) NOT NULL,
        body TEXT,
        link VARCHAR(500),
        related_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_inbox_recipient_unread ON inbox_items(recipient, is_read, created_at DESC)`
    return NextResponse.json({ ok: true, message: 'Inbox tabel klaar' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
