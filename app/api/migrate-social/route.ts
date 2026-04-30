import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (new URL(request.url).searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS social_posts (
        id SERIAL PRIMARY KEY,
        scheduled_for TIMESTAMPTZ NOT NULL,
        platform VARCHAR(20) NOT NULL DEFAULT 'instagram',
        post_type VARCHAR(20) NOT NULL DEFAULT 'feed',
        image_urls JSONB NOT NULL DEFAULT '[]',
        caption TEXT,
        hashtags TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        canva_url TEXT,
        internal_notes TEXT,
        reminder_sent BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    await sql`CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(scheduled_for)`
    await sql`CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status)`
    return NextResponse.json({ ok: true, message: 'social_posts tabel aangemaakt' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
