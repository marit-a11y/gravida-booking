// /api/cron/rodin-poll
//
// Runs every minute (see vercel.json). Walks all ai_scans where
// preview_status IN ('queued', 'generating') and asks Rodin whether the mesh
// is ready. On 'done': downloads the GLB + STL files into Vercel Blob and
// stamps preview_glb_url / preview_stl_url + flips status to 'ready'.
//
// Vercel cron requests carry a special user-agent + bearer header signed
// with CRON_SECRET; we verify both so a random caller cannot trigger
// expensive Rodin downloads.

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { checkPreviewJob, fetchPreviewMesh, activeProvider, startPreviewJob, maskBackground } from '@/lib/preview-provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_GENERATING_AGE_MS = 1000 * 60 * 30  // give up after 30 min stuck

function isCronCall(request: NextRequest): boolean {
  // Vercel signs cron invocations with the CRON_SECRET env var. On the local
  // dev machine we don't have one set, so we also accept the user-agent path.
  const expected = (process.env.CRON_SECRET ?? '').trim()
  const auth     = request.headers.get('authorization') ?? ''
  if (expected && auth === `Bearer ${expected}`)                                       return true
  // Vercel sends a recognisable UA on platform cron invocations.
  const ua = (request.headers.get('user-agent') ?? '').toLowerCase()
  if (ua.includes('vercel-cron'))                                                       return true
  // Manual trigger during dev.
  if (process.env.NODE_ENV !== 'production' && !expected)                               return true
  return false
}

export async function GET(request: NextRequest) {
  if (!isCronCall(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // Skip when the active provider has no creds; the kickoff path already
  // refused to queue jobs in that case so there's nothing to poll.
  const provider = activeProvider()
  if (provider === 'rodin' && !process.env.RODIN_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'PREVIEW_PROVIDER=rodin but no RODIN_API_KEY' })
  }
  if (provider === 'replicate' && !process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ ok: true, skipped: 'PREVIEW_PROVIDER=replicate but no REPLICATE_API_TOKEN' })
  }

  // Fetch the in-flight set. The partial index on preview_status makes this fast.
  const inflight = await sql<{
    id: number,
    session_id: string,
    rodin_subscription_key: string | null,
    preview_status: string,
    preview_started_at: string | null,
  }>`
    SELECT id, session_id, rodin_subscription_key, preview_status, preview_started_at
    FROM ai_scans
    WHERE preview_status IN ('queued', 'generating')
    LIMIT 25
  `

  const summary: Array<{ id: number, action: string, detail?: string }> = []

  for (const scan of inflight.rows) {
    // Rescue case: scan is 'queued' but has no subscription_key. This
    // happens when complete() couldn't finish the kickoff (Vercel killed
    // the function before async work completed, Rodin had a hiccup, etc.).
    // Try the kickoff inline here so the scan can still progress.
    if (!scan.rodin_subscription_key) {
      try {
        const photoRows = await sql<{ blob_url: string }>`
          SELECT blob_url FROM ai_scan_photos
          WHERE scan_id = ${scan.id} AND angle != 'detail'
          ORDER BY angle, order_idx LIMIT 5
        `
        const imageUrls = photoRows.rows.map(r => r.blob_url)
        if (imageUrls.length === 0) {
          summary.push({ id: scan.id, action: 'rescue-skipped-no-photos' })
          continue
        }
        // Same rembg + 3D pipeline as complete(), inline.
        let urlsForProvider = imageUrls
        try {
          const masked = await maskBackground(imageUrls[0])
          if (masked) {
            await sql`UPDATE ai_scans SET masked_image_url = ${masked} WHERE id = ${scan.id}`
            urlsForProvider = [masked, ...imageUrls.slice(1)]
          }
        } catch {}
        const job = await startPreviewJob({ imageUrls: urlsForProvider })
        if (job?.jobKey) {
          await sql`
            UPDATE ai_scans
               SET rodin_subscription_key = ${job.jobKey},
                   preview_status         = 'generating'
             WHERE id = ${scan.id}
          `
          summary.push({ id: scan.id, action: 'rescued-into-generating' })
        } else {
          summary.push({ id: scan.id, action: 'rescue-startPreviewJob-null' })
        }
      } catch (err) {
        console.error('cron rescue kickoff threw:', err)
        summary.push({ id: scan.id, action: 'rescue-threw', detail: String(err).slice(0, 100) })
      }
      continue
    }

    // Time-out stuck generations so they don't poll forever on a Rodin
    // queue that lost the job. 30 min is generous: a Sketch tier
    // generation normally completes in 1-3 min.
    if (scan.preview_started_at) {
      const age = Date.now() - new Date(scan.preview_started_at).getTime()
      if (age > MAX_GENERATING_AGE_MS) {
        await sql`
          UPDATE ai_scans
             SET preview_status = 'failed',
                 preview_error  = 'stuck in generating state for > 30 min, gave up'
           WHERE id = ${scan.id}
        `
        summary.push({ id: scan.id, action: 'timed-out' })
        continue
      }
    }

    const status = await checkPreviewJob(scan.rodin_subscription_key)
    if (!status) {
      summary.push({ id: scan.id, action: 'status-fetch-failed' })
      continue
    }

    if (status.state === 'failed') {
      await sql`
        UPDATE ai_scans
           SET preview_status = 'failed',
               preview_error  = ${status.error ?? 'provider reported failure'}
         WHERE id = ${scan.id}
      `
      summary.push({ id: scan.id, action: 'failed', detail: status.error })
      continue
    }

    if (status.state === 'queued' || status.state === 'generating') {
      // Flip queued → generating if the provider is now actively working.
      if (scan.preview_status !== status.state) {
        await sql`
          UPDATE ai_scans
             SET preview_status = ${status.state}
           WHERE id = ${scan.id}
        `
      }
      summary.push({ id: scan.id, action: 'still-' + status.state })
      continue
    }

    // status.state === 'done'. Pull the GLB (and STL if the provider
    // supplied one) and copy into our Blob.
    if (!status.glb_url) {
      summary.push({ id: scan.id, action: 'done-but-no-glb-url' })
      continue
    }

    const glbBuf = await fetchPreviewMesh(status.glb_url)
    const stlBuf = status.stl_url ? await fetchPreviewMesh(status.stl_url) : null
    if (!glbBuf) {
      summary.push({ id: scan.id, action: 'glb-download-failed' })
      continue
    }

    // Store both formats under predictable paths so the admin /scan-archief
    // page can find them later by convention.
    const baseName = `ai-scans/${scan.session_id}`
    const glbBlob = await put(`${baseName}/preview.glb`, glbBuf, {
      access: 'public',
      contentType: 'model/gltf-binary',
      addRandomSuffix: false,
    })
    const stlBlob = stlBuf
      ? await put(`${baseName}/preview.stl`, stlBuf, {
          access: 'public',
          contentType: 'model/stl',
          addRandomSuffix: false,
        })
      : null

    await sql`
      UPDATE ai_scans
         SET preview_status        = 'ready',
             preview_glb_url       = ${glbBlob.url},
             preview_stl_url       = ${stlBlob?.url ?? null},
             preview_completed_at  = NOW(),
             preview_error         = NULL
       WHERE id = ${scan.id}
    `
    summary.push({ id: scan.id, action: 'ready' })
  }

  return NextResponse.json({ ok: true, processed: summary.length, summary })
}
