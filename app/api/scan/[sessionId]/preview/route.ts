// GET /api/scan/<sessionId>/preview
//
// Public endpoint the Gravida Scan app polls every 5 seconds while showing
// the "Sculpting your form..." screen. Returns the preview state + mesh URL
// when ready.
//
// Response shape:
//   { state: 'queued' | 'generating' | 'ready' | 'failed' | 'unavailable',
//     glb_url?: string,
//     started_at?: string,
//     elapsed_seconds?: number,
//     error?: string }
//
// 'unavailable' = the row has no preview_status at all yet (e.g. complete()
// failed to kick off the generation, or Rodin is disabled by env). App treats
// this as "no preview, skip to Atelier collection directly".

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { checkScanAppToken, SCAN_CORS_HEADERS } from '@/lib/scan-auth'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: SCAN_CORS_HEADERS })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  if (!checkScanAppToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: SCAN_CORS_HEADERS })
  }

  const row = await sql<{
    preview_status: string | null,
    preview_glb_url: string | null,
    preview_started_at: string | null,
    preview_error: string | null,
  }>`
    SELECT preview_status, preview_glb_url, preview_started_at, preview_error
    FROM ai_scans
    WHERE session_id = ${params.sessionId}
    LIMIT 1
  `
  if (!row.rows[0]) {
    return NextResponse.json({ error: 'unknown session' }, { status: 404, headers: SCAN_CORS_HEADERS })
  }

  const r = row.rows[0]
  const state = (r.preview_status ?? 'unavailable') as
    'queued' | 'generating' | 'ready' | 'failed' | 'unavailable'

  const elapsed =
    r.preview_started_at
      ? Math.round((Date.now() - new Date(r.preview_started_at).getTime()) / 1000)
      : null

  return NextResponse.json(
    {
      state,
      glb_url:         state === 'ready' ? (r.preview_glb_url ?? undefined) : undefined,
      started_at:      r.preview_started_at ?? undefined,
      elapsed_seconds: elapsed ?? undefined,
      error:           state === 'failed' ? (r.preview_error ?? undefined) : undefined,
    },
    { headers: SCAN_CORS_HEADERS }
  )
}
