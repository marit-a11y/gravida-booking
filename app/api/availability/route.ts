import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const region = searchParams.get('region') ?? null
    const today = new Date().toISOString().split('T')[0]

    let rows
    if (region) {
      const result = await sql`
        SELECT id, date::text, region, slots, max_per_slot, notes
        FROM availability
        WHERE is_active = true AND date >= ${today} AND region = ${region}
        ORDER BY date ASC
      `
      rows = result.rows
    } else {
      const result = await sql`
        SELECT id, date::text, region, slots, max_per_slot, notes
        FROM availability
        WHERE is_active = true AND date >= ${today}
        ORDER BY date ASC
      `
      rows = result.rows
    }

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/availability error:', err)
    return NextResponse.json({ error: 'Kan beschikbaarheid niet laden' }, { status: 500 })
  }
}
