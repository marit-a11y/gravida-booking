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

export async function GET(_request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const apiKey = (process.env.RODIN_API_KEY ?? '').trim()
  const apiBase = (process.env.RODIN_API_BASE ?? 'https://hyperhuman.deemos.com/api/v2').replace(/\/$/, '')
  if (!apiKey) {
    return NextResponse.json({ error: 'RODIN_API_KEY niet gezet' }, { status: 400 })
  }

  // Direct Rodin call so we see the raw response shape, no wrapping abstraction.
  let res: Response
  try {
    res = await fetch(`${apiBase}/rodin`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [SAMPLE_IMAGE_URL],
        tier: 'Sketch',
        mesh_mode: 'Raw',
        material: 'PBR',
        output_format: 'glb',
      }),
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
    response_has_subscription_key: !!parsed?.subscription_key,
  })
}
