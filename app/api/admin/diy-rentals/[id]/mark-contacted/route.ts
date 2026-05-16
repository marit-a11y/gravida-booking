import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })
    const body = await request.json().catch(() => ({}))
    const by: string | null = body.by?.trim() || null
    const note: string | null = body.note?.trim() || null

    await sql`
      UPDATE diy_rentals SET
        customer_contacted_at = NOW(),
        customer_contacted_by = ${by},
        customer_contact_note = ${note}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Markeren mislukt: ' + msg }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })
    await sql`
      UPDATE diy_rentals SET
        customer_contacted_at = NULL,
        customer_contacted_by = NULL,
        customer_contact_note = NULL
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
