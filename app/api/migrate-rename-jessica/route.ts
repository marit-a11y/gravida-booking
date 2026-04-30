import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (new URL(request.url).searchParams.get('key') !== 'gravida2026') {
    return NextResponse.json({ error: 'Ongeldige sleutel' }, { status: 403 })
  }
  try {
    const result = await sql`
      UPDATE social_posts SET category = 'Atelier' WHERE category = 'Meet jessica'
    `
    return NextResponse.json({ ok: true, updated: result.rowCount ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
