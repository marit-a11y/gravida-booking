import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folder_id')
    const unfiled = searchParams.get('unfiled') === '1'

    const r = unfiled
      ? await sql`
          SELECT id, folder_id, blob_url, type, filename, label, labels, caption, product_url,
                 size_bytes, width, height, created_at::text
          FROM media_items WHERE folder_id IS NULL
          ORDER BY created_at DESC
        `
      : folderId
        ? await sql`
            SELECT id, folder_id, blob_url, type, filename, label, caption,
                   size_bytes, width, height, created_at::text
            FROM media_items WHERE folder_id = ${parseInt(folderId, 10)}
            ORDER BY created_at DESC
          `
        : await sql`
            SELECT id, folder_id, blob_url, type, filename, label, caption,
                   size_bytes, width, height, created_at::text
            FROM media_items
            ORDER BY created_at DESC
            LIMIT 500
          `
    return NextResponse.json({ items: r.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { folder_id, blob_url, type, filename, label, caption, product_url, size_bytes, width, height } = body
    if (!blob_url) return NextResponse.json({ error: 'blob_url verplicht' }, { status: 400 })
    const r = await sql`
      INSERT INTO media_items (folder_id, blob_url, type, filename, label, caption, product_url, size_bytes, width, height)
      VALUES (
        ${folder_id ?? null}, ${blob_url}, ${type ?? 'image'},
        ${filename ?? null}, ${label ?? null}, ${caption ?? null}, ${product_url ?? null},
        ${size_bytes ?? null}, ${width ?? null}, ${height ?? null}
      )
      RETURNING id, folder_id, blob_url, type, filename, label, caption, product_url, created_at::text
    `
    return NextResponse.json({ item: r.rows[0] }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Toevoegen mislukt: ' + String(err) }, { status: 500 })
  }
}
