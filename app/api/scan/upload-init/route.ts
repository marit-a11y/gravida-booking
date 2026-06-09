// POST /api/scan/upload-init
//
// Called by the Gravida Scan app at the start of a capture session. Creates a
// row in ai_scans with status='in_progress' and returns the public session_id
// (UUID) that subsequent photo + complete calls reference.
//
// Body (JSON, all optional except name and email at submit time, those can be
// posted later via /complete):
//   {
//     first_name?: string,
//     last_name?: string,
//     email?: string,
//     phone?: string,
//     pregnancy_weeks?: number,
//     consent_eu_storage?: boolean,
//     app_version?: string,
//     device_label?: string
//   }
//
// Response:
//   { session_id: "uuid-v4" }

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sql } from '@vercel/postgres'
import { checkScanAppToken, SCAN_CORS_HEADERS } from '@/lib/scan-auth'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: SCAN_CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  if (!checkScanAppToken(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: SCAN_CORS_HEADERS })
  }

  let body: any = {}
  try { body = await request.json() } catch {}

  const sessionId = crypto.randomUUID()

  await sql`
    INSERT INTO ai_scans (
      session_id, client_first_name, client_last_name, client_email, client_phone,
      pregnancy_weeks, consent_eu_storage, app_version, device_label, status
    ) VALUES (
      ${sessionId},
      ${body.first_name ?? null},
      ${body.last_name ?? null},
      ${body.email ?? null},
      ${body.phone ?? null},
      ${typeof body.pregnancy_weeks === 'number' ? body.pregnancy_weeks : null},
      ${body.consent_eu_storage === false ? false : true},
      ${(body.app_version ?? '').toString().slice(0, 40) || null},
      ${(body.device_label ?? '').toString().slice(0, 120) || null},
      'in_progress'
    )
  `

  return NextResponse.json({ session_id: sessionId }, { headers: SCAN_CORS_HEADERS })
}
