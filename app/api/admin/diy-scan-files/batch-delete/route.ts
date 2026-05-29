import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/admin/diy-scan-files/batch-delete
// body: { ids: number[] }
// Verwijdert bestanden uit blob storage én DB. Wordt gebruikt voor de
// "verwijder niet-gekozen scans" batch nadat klant haar voorkeur heeft doorgegeven.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids = Array.isArray(body.ids) ? body.ids.filter((n: unknown) => Number.isInteger(n)) : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Geen geldige ids' }, { status: 400 })
    }

    // Haal blob urls op
    const rows = await sql`SELECT id, blob_url FROM diy_scan_files WHERE id = ANY(${ids}::int[])`
    let blobDeleted = 0, blobFailed = 0
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      for (const r of rows.rows) {
        try { await del(r.blob_url as string); blobDeleted++ }
        catch { blobFailed++ }
      }
    }
    // Verwijder DB rijen
    await sql`DELETE FROM diy_scan_files WHERE id = ANY(${ids}::int[])`

    return NextResponse.json({ ok: true, deleted: ids.length, blobDeleted, blobFailed })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
