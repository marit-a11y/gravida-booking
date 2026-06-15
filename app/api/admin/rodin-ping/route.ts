// GET /api/admin/rodin-ping
//
// Smoke-tests the Rodin API: starts a real Sketch-tier generation with a
// known sample image, returns the subscription_key on success (or the raw
// HTTP body on failure). Costs ~$0.30 in Rodin credits per call, run only
// when you actually want to verify the integration.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyTokenValid as verifyToken, COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const SAMPLE_IMAGE_URL =
  'https://dauksnfas5jzt9b5.public.blob.vercel-storage.com/ai-scans/5621ddde-8d7e-482f-9094-fd37a42a9dfa/front-00.jpg'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const apiKey = (process.env.RODIN_API_KEY ?? '').trim()
  const apiBase = (process.env.RODIN_API_BASE ?? 'https://hyperhuman.deemos.com/api/v2').replace(/\/$/, '')
  if (!apiKey) {
    return NextResponse.json({ error: 'RODIN_API_KEY niet gezet' }, { status: 400 })
  }

  // Optional ?scan_id=N mode: looks up the scan's subscription key and
  // pings status. Avoids stuffing a 444-char JWT into the URL.
  const scanIdParam = request.nextUrl.searchParams.get('scan_id')
  let subKey = request.nextUrl.searchParams.get('sub_key')
  if (!subKey && scanIdParam) {
    const { sql } = await import('@vercel/postgres')
    const id = Number(scanIdParam)
    if (Number.isFinite(id)) {
      const row = await sql<{ k: string | null }>`SELECT rodin_subscription_key AS k FROM ai_scans WHERE id = ${id} LIMIT 1`
      subKey = row.rows[0]?.k ?? null
    }
  }
  if (subKey) {
    let res: Response
    try {
      res = await fetch(`${apiBase}/status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_key: subKey }),
      })
    } catch (err) {
      return NextResponse.json({ error: 'network', detail: String(err) }, { status: 502 })
    }
    const text = await res.text().catch(() => '')
    let parsed: any = null
    try { parsed = JSON.parse(text) } catch {}
    return NextResponse.json({
      mode: 'status',
      api_base: apiBase,
      http_status: res.status,
      http_ok: res.ok,
      response_body: parsed ?? text.slice(0, 4000),
    })
  }

  // Direct Rodin call so we see the raw response shape, no wrapping abstraction.
  // Rodin expects multipart/form-data with image bytes attached, not JSON URLs.
  let res: Response
  try {
    const imgRes = await fetch(SAMPLE_IMAGE_URL)
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'sample image fetch failed', status: imgRes.status }, { status: 502 })
    }
    const blob = await imgRes.blob()
    const form = new FormData()
    form.append('images',         blob, 'sample.jpg')
    form.append('tier',           'Sketch')
    form.append('mesh_mode',      'Raw')
    form.append('material',       'PBR')
    form.append('output_format',  'glb')

    res = await fetch(`${apiBase}/rodin`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },     // do not set Content-Type, fetch handles multipart boundary
      body: form,
    })
  } catch (err) {
    return NextResponse.json({ error: 'network', detail: String(err) }, { status: 502 })
  }

  const text = await res.text().catch(() => '')
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch {}

  return NextResponse.json({
    api_base: apiBase,
    http_status: res.status,
    http_ok: res.ok,
    response_body: parsed ?? text.slice(0, 2000),
    response_has_subscription_key: !!(parsed?.jobs?.subscription_key ?? parsed?.subscription_key),
  })
}
