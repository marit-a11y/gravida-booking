// GET /api/admin/ai-scans/<id>          — full detail incl. all photo URLs
// PATCH /api/admin/ai-scans/<id>         — update status / atelier_notes / customer_number
// DELETE /api/admin/ai-scans/<id>        — remove a scan (and its blobs)
//
// All routes require admin auth via the JWT cookie set by middleware.ts.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyTokenValid as verifyToken, COOKIE_NAME } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  const scan = await sql`SELECT * FROM ai_scans WHERE id = ${id} LIMIT 1`
  if (!scan.rows[0]) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const photos = await sql`
    SELECT id, angle, order_idx, blob_url, mime, bytes, note, created_at
    FROM ai_scan_photos
    WHERE scan_id = ${id}
    ORDER BY angle, order_idx
  `
  return NextResponse.json({ scan: scan.rows[0], photos: photos.rows })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  let body: any = {}
  try { body = await request.json() } catch {}

  // Whitelist of patchable fields. status transitions are stored verbatim, the
  // UI is responsible for not regressing approved → received etc.
  const VALID_STATUS = new Set(['received', 'reviewing', 'approved', 'rejected'])
  const nextStatus = typeof body.status === 'string' && VALID_STATUS.has(body.status) ? body.status : null
  const nextNotes  = typeof body.atelier_notes === 'string' ? body.atelier_notes : null
  const nextCustNr = typeof body.customer_number === 'string' ? body.customer_number.trim() || null : null

  await sql`
    UPDATE ai_scans
       SET status          = COALESCE(${nextStatus}, status),
           atelier_notes   = COALESCE(${nextNotes},  atelier_notes),
           customer_number = COALESCE(${nextCustNr}, customer_number),
           reviewed_at     = CASE WHEN ${nextStatus} IS NOT NULL THEN NOW() ELSE reviewed_at END
     WHERE id = ${id}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  // Best-effort delete of the blobs; the DB rows go regardless so a partial
  // failure doesn't leave the dashboard pointing at nothing.
  try {
    const photos = await sql<{ blob_url: string }>`
      SELECT blob_url FROM ai_scan_photos WHERE scan_id = ${id}
    `
    for (const row of photos.rows) {
      try { await del(row.blob_url) } catch (err) { console.error('blob delete failed:', err) }
    }
  } catch (err) {
    console.error('blob list for delete failed:', err)
  }

  await sql`DELETE FROM ai_scans WHERE id = ${id}` // cascade removes photo rows
  return NextResponse.json({ ok: true })
}
