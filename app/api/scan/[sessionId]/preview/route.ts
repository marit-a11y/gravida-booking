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
import { put } from '@vercel/blob'
import { checkScanAppToken, SCAN_CORS_HEADERS } from '@/lib/scan-auth'
import { checkPreviewJob, fetchPreviewMesh } from '@/lib/preview-provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
    id: number,
    session_id: string,
    preview_status: string | null,
    preview_glb_url: string | null,
    preview_started_at: string | null,
    preview_error: string | null,
    rodin_subscription_key: string | null,
  }>`
    SELECT id, session_id, preview_status, preview_glb_url, preview_started_at,
           preview_error, rodin_subscription_key
    FROM ai_scans
    WHERE session_id = ${params.sessionId}
    LIMIT 1
  `
  if (!row.rows[0]) {
    return NextResponse.json({ error: 'unknown session' }, { status: 404, headers: SCAN_CORS_HEADERS })
  }

  let r = row.rows[0]

  // Self-heal: if the scan is 'generating' and has a provider job key, do an
  // inline status check + download. This makes the polling endpoint
  // responsible for driving its own state forward, so we don't depend on the
  // Vercel cron schedule landing on time. Worst case is a per-poll latency of
  // a few seconds while we wait for the provider's status call.
  //
  // We do this asynchronously enough that a slow provider doesn't keep the
  // app blocked: maxDuration is the route's 60s ceiling, and most provider
  // status calls return in well under a second.
  if ((r.preview_status === 'generating' || r.preview_status === 'queued')
      && r.rodin_subscription_key) {
    try {
      const status = await checkPreviewJob(r.rodin_subscription_key)
      if (status?.state === 'done' && status.glb_url) {
        const glbBuf = await fetchPreviewMesh(status.glb_url)
        if (glbBuf) {
          const blob = await put(
            `ai-scans/${r.session_id}/preview.glb`,
            glbBuf,
            { access: 'public', contentType: 'model/gltf-binary', addRandomSuffix: false },
          )
          let stlUrl: string | null = null
          if (status.stl_url) {
            const stlBuf = await fetchPreviewMesh(status.stl_url)
            if (stlBuf) {
              const stlBlob = await put(
                `ai-scans/${r.session_id}/preview.stl`,
                stlBuf,
                { access: 'public', contentType: 'model/stl', addRandomSuffix: false },
              )
              stlUrl = stlBlob.url
            }
          }
          await sql`
            UPDATE ai_scans
               SET preview_status        = 'ready',
                   preview_glb_url       = ${blob.url},
                   preview_stl_url       = ${stlUrl},
                   preview_completed_at  = NOW(),
                   preview_error         = NULL
             WHERE id = ${r.id}
          `
          r = { ...r, preview_status: 'ready', preview_glb_url: blob.url }
        }
      } else if (status?.state === 'failed') {
        await sql`
          UPDATE ai_scans
             SET preview_status = 'failed',
                 preview_error  = ${status.error ?? 'provider reported failure'}
           WHERE id = ${r.id}
        `
        r = { ...r, preview_status: 'failed', preview_error: status.error ?? null }
      }
    } catch (err) {
      // Network blip or provider hiccup: leave the row untouched, the next
      // poll (5 sec later) will try again. Don't fail the response.
      console.error('preview self-heal failed:', err)
    }
  }
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
