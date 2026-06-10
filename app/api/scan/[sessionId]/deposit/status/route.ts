// GET /api/scan/<sessionId>/deposit/status
//
// PaidPreviewScreen polls this after the Mollie redirect to fetch the
// generated coupon code. Mollie webhook may take a few seconds to land, so
// the app polls every 2s until `state` flips to 'paid' (or 'pending' returns
// for too long, in which case the app shows the "we'll email you" fallback).
//
// Response:
//   { state: 'pending' | 'paid' | 'failed' | 'unavailable',
//     coupon_code?: string,
//     paid_at?: string }

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
    deposit_amount_cents:      number | null,
    deposit_mollie_payment_id: string | null,
    deposit_paid_at:           string | null,
    deposit_coupon_code:       string | null,
  }>`
    SELECT deposit_amount_cents, deposit_mollie_payment_id, deposit_paid_at, deposit_coupon_code
    FROM ai_scans WHERE session_id = ${params.sessionId} LIMIT 1
  `
  if (!row.rows[0]) {
    return NextResponse.json({ error: 'unknown session' }, { status: 404, headers: SCAN_CORS_HEADERS })
  }
  const r = row.rows[0]
  let state: 'pending' | 'paid' | 'unavailable' = 'unavailable'
  if (r.deposit_paid_at) state = 'paid'
  else if (r.deposit_mollie_payment_id) state = 'pending'
  return NextResponse.json(
    {
      state,
      coupon_code: r.deposit_coupon_code ?? undefined,
      paid_at:     r.deposit_paid_at ?? undefined,
    },
    { headers: SCAN_CORS_HEADERS }
  )
}
