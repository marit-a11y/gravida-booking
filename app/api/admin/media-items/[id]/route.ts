import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const e = await sql`SELECT * FROM media_items WHERE id = ${id}`
    if (e.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const ex = e.rows[0]
    const labelsValue = body.labels !== undefined
      ? JSON.stringify(Array.isArray(body.labels) ? body.labels : [])
      : JSON.stringify(ex.labels ?? [])

    // Multi-folder support via media_item_folders
    if (body.folder_ids !== undefined && Array.isArray(body.folder_ids)) {
      const list: number[] = body.folder_ids.filter((x: unknown) => typeof x === 'number')
      await sql`DELETE FROM media_item_folders WHERE item_id = ${id}`
      for (const fid of list) {
        await sql`INSERT INTO media_item_folders (item_id, folder_id) VALUES (${id}, ${fid}) ON CONFLICT DO NOTHING`
      }
      // Keep primary folder_id in sync with first entry (for backward compat)
      const primary = list.length > 0 ? list[0] : null
      await sql`UPDATE media_items SET folder_id = ${primary} WHERE id = ${id}`
    } else if (body.folder_id !== undefined) {
      // Legacy single-folder update
      await sql`DELETE FROM media_item_folders WHERE item_id = ${id}`
      if (body.folder_id !== null) {
        await sql`INSERT INTO media_item_folders (item_id, folder_id) VALUES (${id}, ${body.folder_id}) ON CONFLICT DO NOTHING`
      }
      await sql`UPDATE media_items SET folder_id = ${body.folder_id} WHERE id = ${id}`
    }

    await sql`
      UPDATE media_items SET
        label = ${body.label !== undefined ? body.label : ex.label},
        labels = ${labelsValue}::jsonb,
        caption = ${body.caption !== undefined ? body.caption : ex.caption},
        filename = ${body.filename !== undefined ? body.filename : ex.filename},
        product_url = ${body.product_url !== undefined ? body.product_url : ex.product_url}
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    await sql`DELETE FROM media_items WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
