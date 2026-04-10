import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const total = await sql`SELECT COUNT(*) as n FROM availability`
    const active = await sql`SELECT COUNT(*) as n FROM availability WHERE is_active = true`
    const future = await sql`SELECT COUNT(*) as n FROM availability WHERE is_active = true AND date >= ${today}`
    const regions = await sql`SELECT DISTINCT region FROM availability ORDER BY region`
    const sample = await sql`SELECT id, date::text, region, is_active FROM availability ORDER BY date DESC LIMIT 5`
    return NextResponse.json({
      today,
      total: total.rows[0].n,
      active: active.rows[0].n,
      future: future.rows[0].n,
      regions: regions.rows.map(r => r.region),
      sample: sample.rows,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) })
  }
}
