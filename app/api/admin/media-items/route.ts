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
          SELECT i.id, i.folder_id, i.blob_url, i.type, i.filename, i.label, i.labels, i.caption, i.product_url,
                 i.size_bytes, i.width, i.height, i.created_at::text,
                 COALESCE((SELECT array_agg(folder_id) FROM media_item_folders mif WHERE mif.item_id = i.id), '{}') AS folder_ids
          FROM media_items i
          WHERE NOT EXISTS (SELECT 1 FROM media_item_folders mif WHERE mif.item_id = i.id)
            AND i.folder_id IS NULL
          ORDER BY i.created_at DESC
        `
      : folderId
        ? await sql`
            SELECT i.id, i.folder_id, i.blob_url, i.type, i.filename, i.label, i.labels, i.caption, i.product_url,
                   i.size_bytes, i.width, i.height, i.created_at::text,
                   COALESCE((SELECT array_agg(folder_id) FROM media_item_folders mif WHERE mif.item_id = i.id), '{}') AS folder_ids
            FROM media_items i
            WHERE EXISTS (
              SELECT 1 FROM media_item_folders mif
              WHERE mif.item_id = i.id
                AND (mif.folder_id = ${parseInt(folderId, 10)}
                     OR mif.folder_id IN (SELECT id FROM media_folders WHERE parent_id = ${parseInt(folderId, 10)}))
            )
            ORDER BY i.created_at DESC
          `
        : await sql`
            SELECT i.id, i.folder_id, i.blob_url, i.type, i.filename, i.label, i.labels, i.caption, i.product_url,
                   i.size_bytes, i.width, i.height, i.created_at::text,
                   COALESCE((SELECT array_agg(folder_id) FROM media_item_folders mif WHERE mif.item_id = i.id), '{}') AS folder_ids
            FROM media_items i
            ORDER BY i.created_at DESC
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
    const { folder_id, folder_ids, blob_url, type, filename, label, caption, product_url, size_bytes, width, height } = body
    if (!blob_url) return NextResponse.json({ error: 'blob_url verplicht' }, { status: 400 })

    // Determine folder list (folder_ids preferred, falls back to single folder_id)
    const folderList: number[] = Array.isArray(folder_ids) && folder_ids.length > 0
      ? folder_ids.filter((x: unknown) => typeof x === 'number')
      : (folder_id != null ? [folder_id] : [])
    const primaryFolder = folderList.length > 0 ? folderList[0] : null

    const r = await sql`
      INSERT INTO media_items (folder_id, blob_url, type, filename, label, caption, product_url, size_bytes, width, height)
      VALUES (
        ${primaryFolder}, ${blob_url}, ${type ?? 'image'},
        ${filename ?? null}, ${label ?? null}, ${caption ?? null}, ${product_url ?? null},
        ${size_bytes ?? null}, ${width ?? null}, ${height ?? null}
      )
      RETURNING id, folder_id, blob_url, type, filename, label, caption, product_url, created_at::text
    `
    const newId = r.rows[0].id
    for (const fid of folderList) {
      await sql`INSERT INTO media_item_folders (item_id, folder_id) VALUES (${newId}, ${fid}) ON CONFLICT DO NOTHING`
    }
    return NextResponse.json({ item: { ...r.rows[0], folder_ids: folderList } }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Toevoegen mislukt: ' + String(err) }, { status: 500 })
  }
}
