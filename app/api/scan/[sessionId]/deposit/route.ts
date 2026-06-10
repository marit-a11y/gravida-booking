// POST /api/scan/<sessionId>/deposit
//
// Called by the Gravida Scan app from the PreviewScreen when the customer
// taps "Reserve with €35 deposit". Creates a Mollie payment in the same
// project as the existing DIY scanner deposits, returns the hosted checkout
// URL the app then redirects to.
//
// Mollie hits /api/mollie/scan-deposit-webhook on completion with the
// payment id; that webhook does the WooCommerce coupon creation and the
// confirmation email.
//
// Body (JSON):
//   { email?: string, first_name?: string }   // top-up if not yet on the scan

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import createMollieClient from '@mollie/api-client'
import { checkScanAppToken, SCAN_CORS_HEADERS } from '@/lib/scan-auth'

export const dynamic = 'force-dynamic'

const DEPOSIT_AMOUNT_EUR    = 35
const DEPOSIT_CURRENCY      = 'EUR'
const DEPOSIT_DESCRIPTION   = 'Gravida sculpture reservation (€35 credit on order)'

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
  if (!process.env.MOLLIE_API_KEY) {
    return NextResponse.json({ error: 'mollie not configured' }, { status: 500, headers: SCAN_CORS_HEADERS })
  }

  let body: any = {}
  try { body = await request.json() } catch {}

  const scan = await sql<{
    id: number, client_email: string|null, client_first_name: string|null,
    deposit_paid_at: string|null, deposit_mollie_payment_id: string|null,
  }>`
    SELECT id, client_email, client_first_name, deposit_paid_at, deposit_mollie_payment_id
    FROM ai_scans WHERE session_id = ${params.sessionId} LIMIT 1
  `
  const scanRow = scan.rows[0]
  if (!scanRow) {
    return NextResponse.json({ error: 'unknown session' }, { status: 404, headers: SCAN_CORS_HEADERS })
  }

  // Idempotency: if the deposit is already paid, return the success URL
  // instead of charging twice.
  if (scanRow.deposit_paid_at) {
    return NextResponse.json({
      error: 'already paid',
      already_paid: true,
    }, { status: 409, headers: SCAN_CORS_HEADERS })
  }

  // Top up identity fields if the app provided them now (covers the case
  // where complete() was called anonymously and the customer only fills in
  // their email at the deposit step).
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const normalisedEmail = (typeof body.email === 'string' && emailRe.test(body.email.trim()))
    ? body.email.trim().toLowerCase() : null
  await sql`
    UPDATE ai_scans
       SET client_first_name = COALESCE(${body.first_name ?? null}, client_first_name),
           client_email      = COALESCE(${normalisedEmail}, client_email)
     WHERE id = ${scanRow.id}
  `

  const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY })

  // Return URL bounces the customer back into the app with ?paid=GRV-XXXX so
  // App() can detect the success state on load and jump to PaidPreviewScreen.
  const appBase = (process.env.NEXT_PUBLIC_SCAN_APP_URL ?? 'https://gravida-app.vercel.app').replace(/\/$/, '')
  const apiBase = (process.env.NEXT_PUBLIC_SITE_URL    ?? 'https://dashboard.gravida.nl').replace(/\/$/, '')

  // We don't know the coupon code yet (webhook creates it). The app polls a
  // public endpoint after redirect to pick up the code; for now we just
  // bounce with the session id, the coupon code is fetched at PaidPreview
  // boot.
  const returnUrl  = `${appBase}/?paid=pending&session=${encodeURIComponent(params.sessionId)}`
  const webhookUrl = `${apiBase}/api/mollie/scan-deposit-webhook`

  try {
    const payment = await mollie.payments.create({
      amount:      { currency: DEPOSIT_CURRENCY, value: DEPOSIT_AMOUNT_EUR.toFixed(2) },
      description: DEPOSIT_DESCRIPTION,
      redirectUrl: returnUrl,
      webhookUrl,
      metadata: {
        scan_id:    scanRow.id,
        session_id: params.sessionId,
      },
    })

    await sql`
      UPDATE ai_scans
         SET deposit_amount_cents      = ${DEPOSIT_AMOUNT_EUR * 100},
             deposit_mollie_payment_id = ${payment.id}
       WHERE id = ${scanRow.id}
    `

    return NextResponse.json(
      { ok: true, checkout_url: payment.getCheckoutUrl(), payment_id: payment.id },
      { headers: SCAN_CORS_HEADERS }
    )
  } catch (err) {
    console.error('Mollie create payment failed:', err)
    return NextResponse.json(
      { error: 'could not create payment', detail: String(err) },
      { status: 500, headers: SCAN_CORS_HEADERS }
    )
  }
}
