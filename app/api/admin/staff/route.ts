import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await sql`
      SELECT id, name, email, regions, notes, is_active, created_at::text
      FROM staff
      ORDER BY id ASC
    `
    return NextResponse.json({ staff: result.rows })
  } catch (err) {
    console.error('GET /api/admin/staff error:', err)
    return NextResponse.json({ error: 'Kan medewerkers niet laden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email, regions, notes } = await request.json()
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }
    const result = await sql`
      INSERT INTO staff (name, email, regions, notes)
      VALUES (
        ${name.trim()},
        ${email?.trim() || null},
        ${JSON.stringify(regions ?? [])}::jsonb,
        ${notes?.trim() || null}
      )
      RETURNING id, name, email, regions, notes, is_active, created_at::text
    `
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/staff error:', err)
    return NextResponse.json({ error: 'Medewerker aanmaken mislukt' }, { status: 500 })
  }
}
