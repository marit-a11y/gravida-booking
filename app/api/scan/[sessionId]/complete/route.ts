// POST /api/scan/<sessionId>/complete
//
// Called by the Gravida Scan app once the customer has uploaded all photos and
// confirmed their details. Flips the session from 'in_progress' to 'received'
// and notifies the Atelier so Laila knows a new scan is waiting.
//
// Body (JSON, all optional, used to top up fields not set at init time):
//   {
//     first_name?: string,
//     last_name?: string,
//     email: string,           // required at this point
//     phone?: string,
//     pregnancy_weeks?: number
//   }
//
// Response:
//   { ok: true, session_id, status: 'received' }

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { Resend } from 'resend'
import { checkScanAppToken, SCAN_CORS_HEADERS } from '@/lib/scan-auth'
import { startPreviewJob, activeProvider, maskBackground } from '@/lib/preview-provider'

export const maxDuration = 60

export const dynamic = 'force-dynamic'

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

  let body: any = {}
  try { body = await request.json() } catch {}

  // Email is optional at finalise time. If absent the scan still lands in the
  // admin inbox but the "send approval mail" button stays disabled until Laila
  // adds an address or matches it with a booking.
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const normalisedEmail: string | null =
    (typeof body.email === 'string' && emailRe.test(body.email.trim()))
      ? body.email.trim().toLowerCase()
      : null

  const sessionId = params.sessionId
  const scan = await sql<{ id: number, status: string }>`
    SELECT id, status FROM ai_scans WHERE session_id = ${sessionId} LIMIT 1
  `
  if (!scan.rows[0]) {
    return NextResponse.json({ error: 'unknown session' }, { status: 404, headers: SCAN_CORS_HEADERS })
  }
  if (scan.rows[0].status !== 'in_progress') {
    return NextResponse.json({ error: 'session already finalised' }, { status: 409, headers: SCAN_CORS_HEADERS })
  }

  // Top up identity fields if the app provided them now.
  await sql`
    UPDATE ai_scans
       SET client_first_name = COALESCE(${body.first_name ?? null}, client_first_name),
           client_last_name  = COALESCE(${body.last_name  ?? null}, client_last_name),
           client_email      = COALESCE(${normalisedEmail}, client_email),
           client_phone      = COALESCE(${body.phone ?? null}, client_phone),
           pregnancy_weeks   = COALESCE(${typeof body.pregnancy_weeks === 'number' ? body.pregnancy_weeks : null}, pregnancy_weeks),
           status            = 'received',
           received_at       = NOW()
     WHERE id = ${scan.rows[0].id}
  `

  // How many photos did they actually send? Useful for the notification email.
  const photoCount = await sql<{ c: number }>`
    SELECT COUNT(*)::int AS c FROM ai_scan_photos WHERE scan_id = ${scan.rows[0].id}
  `

  // Kick off the auto-preview generation with whichever provider is active
  // (PREVIEW_PROVIDER env: 'rodin' or 'replicate'; replicate is the default
  // while we wait for Rodin Business). The cron job /api/cron/rodin-poll
  // picks up the result every minute and writes the mesh URLs back to
  // ai_scans.preview_glb_url / preview_stl_url.
  //
  // Fire-and-forget: we don't block the complete() response on this. If the
  // provider is misconfigured or down, preview_status flips to 'failed' so
  // Laila can fall back to manual review.
  const provider = activeProvider()
  const providerKeySet =
    (provider === 'rodin' && !!process.env.RODIN_API_KEY) ||
    (provider === 'replicate' && !!process.env.REPLICATE_API_TOKEN)

  if (providerKeySet) {
    try {
      const photoRows = await sql<{ blob_url: string }>`
        SELECT blob_url
        FROM ai_scan_photos
        WHERE scan_id = ${scan.rows[0].id} AND angle != 'detail'
        ORDER BY angle, order_idx
        LIMIT 5
      `
      const imageUrls = photoRows.rows.map(r => r.blob_url)
      if (imageUrls.length > 0) {
        await sql`
          UPDATE ai_scans
             SET preview_status     = 'queued',
                 preview_started_at = NOW(),
                 scan_mode          = COALESCE(${body.scan_mode ?? null}, scan_mode)
           WHERE id = ${scan.rows[0].id}
        `
        // Schedule the masking + provider call onto the background event loop
        // so the HTTP response returns to the app fast.
        //
        // Two stages:
        //   a. rembg the front photo so Hunyuan3D / Rodin only see the
        //      subject, not the room behind them.
        //   b. fire the 3D generation with the masked URL (or raw URL if
        //      masking failed, so the pipeline degrades gracefully).
        ;(async () => {
          const frontUrl = imageUrls[0]
          let urlsForProvider = imageUrls
          try {
            const masked = await maskBackground(frontUrl)
            if (masked) {
              await sql`UPDATE ai_scans SET masked_image_url = ${masked} WHERE id = ${scan.rows[0].id}`
              urlsForProvider = [masked, ...imageUrls.slice(1)]
            }
          } catch (err) {
            // Mask failure is non-fatal; we just fall back to the raw photo.
            console.error('rembg pre-step failed:', err)
          }
          const job = await startPreviewJob({ imageUrls: urlsForProvider })
          if (job?.jobKey) {
            await sql`
              UPDATE ai_scans
                 SET rodin_subscription_key = ${job.jobKey},
                     preview_status         = 'generating'
               WHERE id = ${scan.rows[0].id}
            `
          } else {
            await sql`
              UPDATE ai_scans
                 SET preview_status = 'failed',
                     preview_error  = 'startPreviewJob returned null, see server logs'
               WHERE id = ${scan.rows[0].id}
            `
          }
        })().catch(err => console.error('preview kickoff failed:', err))
      }
    } catch (err) {
      console.error('preview kickoff setup failed:', err)
    }
  }

  // Lightweight Atelier-side notification. Not the customer-facing approval mail,
  // that gets sent by Laila from the admin once she has reviewed.
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const dashboardUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dashboard.gravida.nl'}/admin/ai-beoordeling?id=${scan.rows[0].id}`
      const fullName = [body.first_name, body.last_name].filter(Boolean).join(' ').trim() || '(geen naam)'
      const from = (process.env.EMAIL_FROM ?? 'Gravida <hi@gravida.nl>').trim()
      const inboxTo = (process.env.ATELIER_INBOX_EMAIL ?? 'hi@gravida.nl').trim()
      await resend.emails.send({
        from,
        to: inboxTo,
        subject: `Nieuwe AI-scan binnen, ${fullName}`,
        html: `
          <p>Een nieuwe scan via de app is binnengekomen.</p>
          <ul>
            <li><b>Klant:</b> ${fullName}</li>
            <li><b>E-mail:</b> ${normalisedEmail ?? '(niet opgegeven)'}</li>
            <li><b>Aantal foto's:</b> ${photoCount.rows[0]?.c ?? 0}</li>
            <li><b>Status:</b> received</li>
          </ul>
          <p><a href="${dashboardUrl}">Open in dashboard</a></p>
        `,
      })
    }
  } catch (err) {
    // We do not fail the request on notification errors — the scan is safe in the DB.
    console.error('atelier notification email failed:', err)
  }

  return NextResponse.json(
    { ok: true, session_id: sessionId, status: 'received' },
    { headers: SCAN_CORS_HEADERS }
  )
}
