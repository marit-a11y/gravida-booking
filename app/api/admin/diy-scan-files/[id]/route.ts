import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

// PUT — wijzig scan_label, notes, of is_chosen
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const e = await sql`SELECT * FROM diy_scan_files WHERE id = ${id}`
    if (e.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const ex = e.rows[0]
    const newLabel = body.scan_label !== undefined
      ? ([1, 2].includes(Number(body.scan_label)) ? Number(body.scan_label) : ex.scan_label)
      : ex.scan_label
    await sql`
      UPDATE diy_scan_files SET
        scan_label = ${newLabel},
        notes = ${body.notes !== undefined ? body.notes : ex.notes},
        is_chosen = ${body.is_chosen !== undefined ? !!body.is_chosen : ex.is_chosen}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE — verwijder bestand (uit blob storage én DB)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const e = await sql`SELECT blob_url FROM diy_scan_files WHERE id = ${id}`
    if (e.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const url = e.rows[0].blob_url as string
    if (url && process.env.BLOB_READ_WRITE_TOKEN) {
      try { await del(url) } catch { /* blob misschien al weg */ }
    }
    await sql`DELETE FROM diy_scan_files WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
