import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get('region') ?? null
    const today = new Date().toISOString().split('T')[0]

    const total = await sql`SELECT COUNT(*) as n FROM availability`
    const regions = await sql`SELECT DISTINCT region FROM availability ORDER BY region`

    // Test the exact same query as the public API
    let filtered: { rows: unknown[] } = { rows: [] }
    if (region) {
      filtered = await sql`
        SELECT id, date::text, region, slots, max_per_slot, notes
        FROM availability
        WHERE is_active = true AND date >= ${today} AND region = ${region}
        ORDER BY date ASC
      `
    } else {
      filtered = await sql`
        SELECT id, date::text, region, slots, max_per_slot, notes
        FROM availability
        WHERE is_active = true AND date >= ${today}
        ORDER BY date ASC
        LIMIT 5
      `
    }

    return NextResponse.json({
      today,
      region_param: region,
      region_length: region ? region.length : null,
      region_chars: region ? Array.from(region).map(c => c.charCodeAt(0)) : null,
      total: total.rows[0],
      all_regions: regions.rows.map(r => r.region),
      filtered_count: filtered.rows.length,
      filtered_rows: filtered.rows,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) })
  }
}
