// POST /api/scan/<sessionId>/photo
//
// Accepts one photo for an in-progress scan session. multipart/form-data:
//   file       — the image (JPEG/PNG/WebP, <= 15 MB)
//   angle      — one of: front | right | back | left | detail
//   order_idx  — integer, position within its angle (0 for the main 4; 0..N for details)
//   note       — only for angle='detail', short text from the customer
//
// Writes the bytes to Vercel Blob and a row in ai_scan_photos.
//
// Enforces a per-session quota so the public endpoint can't be used as
// free storage. 4 main + up to 8 details = 12 photo cap.

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { sql } from '@vercel/postgres'
import { checkScanAppToken, SCAN_CORS_HEADERS } from '@/lib/scan-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 15 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VALID_ANGLES = new Set(['front', 'right', 'back', 'left', 'detail'])
const MAX_PHOTOS_PER_SESSION = 12

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: SCAN_CORS_HEADERS })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!checkScanAppToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: SCAN_CORS_HEADERS })
  }

  // Look up the session and verify it is still accepting uploads.
  const sessionId = params.sessionId
  const scan = await sql<{ id: number, status: string }>`
    SELECT id, status FROM ai_scans WHERE session_id = ${sessionId} LIMIT 1
  `
  const scanRow = scan.rows[0]
  if (!scanRow) {
    return NextResponse.json({ error: 'unknown session' }, { status: 404, headers: SCAN_CORS_HEADERS })
  }
  if (scanRow.status !== 'in_progress') {
    return NextResponse.json({ error: 'session already finalised' }, { status: 409, headers: SCAN_CORS_HEADERS })
  }

  // Per-session cap.
  const countRow = await sql<{ c: number }>`
    SELECT COUNT(*)::int AS c FROM ai_scan_photos WHERE scan_id = ${scanRow.id}
  `
  if ((countRow.rows[0]?.c ?? 0) >= MAX_PHOTOS_PER_SESSION) {
    return NextResponse.json({ error: 'too many photos for this session' }, { status: 413, headers: SCAN_CORS_HEADERS })
  }

  // Parse multipart form.
  let form: FormData
  try { form = await request.formData() } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400, headers: SCAN_CORS_HEADERS })
  }

  const file = form.get('file')
  const angle = (form.get('angle') ?? '').toString().toLowerCase()
  const orderIdxRaw = form.get('order_idx')
  const note = (form.get('note') ?? '').toString().slice(0, 240) || null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file' }, { status: 400, headers: SCAN_CORS_HEADERS })
  }
  if (!VALID_ANGLES.has(angle)) {
    return NextResponse.json({ error: 'invalid angle' }, { status: 400, headers: SCAN_CORS_HEADERS })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `photo too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413, headers: SCAN_CORS_HEADERS })
  }
  if (!TYPES.includes(file.type)) {
    return NextResponse.json({ error: `mime not allowed: ${file.type}` }, { status: 415, headers: SCAN_CORS_HEADERS })
  }

  const orderIdx = Number.isFinite(Number(orderIdxRaw)) ? Number(orderIdxRaw) : 0

  // Upload to Vercel Blob. The folder layout mirrors how diy-scan-files names
  // things, so /admin/scan-archief stays predictable.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'blob storage not configured' }, { status: 500, headers: SCAN_CORS_HEADERS })
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const safe = `${angle}-${String(orderIdx).padStart(2, '0')}.${ext}`
  const pathname = `ai-scans/${sessionId}/${safe}`
  const blob = await put(pathname, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: false,
  })

  await sql`
    INSERT INTO ai_scan_photos (scan_id, angle, order_idx, blob_url, blob_pathname, mime, bytes, note)
    VALUES (
      ${scanRow.id},
      ${angle},
      ${orderIdx},
      ${blob.url},
      ${pathname},
      ${file.type},
      ${file.size},
      ${note}
    )
  `

  return NextResponse.json(
    { ok: true, url: blob.url, angle, order_idx: orderIdx },
    { headers: SCAN_CORS_HEADERS }
  )
}
