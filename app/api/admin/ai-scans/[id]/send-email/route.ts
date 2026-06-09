// POST /api/admin/ai-scans/<id>/send-email
//
// Sends the customer-facing approval email for an AI scan. Body:
//   {
//     extra_wensen?: string,
//     selected_photo_ids: number[]   // which photos to attach to the email
//   }
//
// The email comes from Laila via Resend, with the chosen photo blob URLs
// fetched, downloaded, and attached as files. Updates the scan to
// status='approved' and stamps sent_email_at.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyTokenValid as verifyToken, COOKIE_NAME } from '@/lib/auth'
import { sql } from '@vercel/postgres'
import { sendAiScanReviewEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const id = Number(params.id)
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'invalid id' }, { status: 400 })

  let body: any = {}
  try { body = await request.json() } catch {}
  const extraWensen: string | null = typeof body.extra_wensen === 'string' ? body.extra_wensen.trim() || null : null
  const selectedIds: number[] = Array.isArray(body.selected_photo_ids) ? body.selected_photo_ids.filter((n: any) => Number.isFinite(n)) : []

  const scan = await sql<{
    id: number, client_first_name: string|null, client_last_name: string|null,
    client_email: string|null, customer_number: string|null
  }>`
    SELECT id, client_first_name, client_last_name, client_email, customer_number
    FROM ai_scans WHERE id = ${id} LIMIT 1
  `
  const scanRow = scan.rows[0]
  if (!scanRow) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (!scanRow.client_email) return NextResponse.json({ error: 'klant heeft geen e-mailadres ingevuld' }, { status: 400 })

  // Pick the selected photos (or all photos for the scan if none were chosen).
  const photos = selectedIds.length > 0
    ? await sql<{ id: number, blob_url: string, angle: string, order_idx: number, mime: string }>`
        SELECT id, blob_url, angle, order_idx, mime
        FROM ai_scan_photos
        WHERE scan_id = ${scanRow.id} AND id = ANY(${selectedIds as any})
        ORDER BY angle, order_idx
      `
    : await sql<{ id: number, blob_url: string, angle: string, order_idx: number, mime: string }>`
        SELECT id, blob_url, angle, order_idx, mime
        FROM ai_scan_photos
        WHERE scan_id = ${scanRow.id}
        ORDER BY angle, order_idx
      `

  // Fetch each blob into a Buffer for Resend attachments.
  const attachments: { filename: string; content: Buffer }[] = []
  for (const p of photos.rows) {
    try {
      const res = await fetch(p.blob_url)
      if (!res.ok) { console.error('blob fetch failed:', p.blob_url, res.status); continue }
      const buf = Buffer.from(await res.arrayBuffer())
      const ext = (p.mime.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg')
      attachments.push({
        filename: `${p.angle}-${String(p.order_idx).padStart(2, '0')}.${ext}`,
        content: buf,
      })
    } catch (err) {
      console.error('blob fetch errored:', err)
    }
  }

  const klantNaam = [scanRow.client_first_name, scanRow.client_last_name].filter(Boolean).join(' ').trim()
  await sendAiScanReviewEmail({
    klant_naam:      klantNaam || 'jij',
    klant_email:     scanRow.client_email,
    customer_number: scanRow.customer_number,
    extra_wensen:    extraWensen,
    images:          attachments,
  })

  await sql`
    UPDATE ai_scans
       SET status        = 'approved',
           atelier_notes = COALESCE(${extraWensen}, atelier_notes),
           sent_email_at = NOW(),
           reviewed_at   = COALESCE(reviewed_at, NOW())
     WHERE id = ${scanRow.id}
  `

  return NextResponse.json({ ok: true, photos: attachments.length })
}
