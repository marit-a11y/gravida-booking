import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (new URL(request.url).searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }
  try {
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS category VARCHAR(50)`
    await sql`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS title VARCHAR(200)`
    return NextResponse.json({ ok: true, message: 'category + title kolommen toegevoegd' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
