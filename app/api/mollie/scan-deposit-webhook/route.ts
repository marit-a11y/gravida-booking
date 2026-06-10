// POST /api/mollie/scan-deposit-webhook
//
// Mollie calls this with `id=<payment_id>` (form-encoded) when the payment
// state changes. We fetch the payment from Mollie, and if status is 'paid':
//   1. mark ai_scans.deposit_paid_at = NOW()
//   2. generate a unique WooCommerce coupon code GRV-XXXXX worth €35
//      (fixed_cart, single-use, restricted to the customer's email)
//   3. store the code on the scan row
//   4. send the confirmation email with the code
//
// All other Mollie statuses (open, canceled, expired, failed) we just log;
// the deposit_paid_at column stays null so the app's "Reserve €35" CTA still
// works on a retry.

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import createMollieClient from '@mollie/api-client'
import { createWooCoupon } from '@/lib/woocommerce'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

function randomCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // skip I/O/0/1 for readability
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return `GRV-${s}`
}

export async function POST(request: NextRequest) {
  if (!process.env.MOLLIE_API_KEY) {
    return NextResponse.json({ error: 'mollie not configured' }, { status: 500 })
  }

  let paymentId: string | null = null
  try {
    const form = await request.formData()
    paymentId = (form.get('id') ?? '').toString().trim() || null
  } catch {
    // Some Mollie env variants send JSON; try that as a fallback.
    try {
      const body: any = await request.json()
      paymentId = body?.id ?? null
    } catch {}
  }
  if (!paymentId) {
    return NextResponse.json({ error: 'missing payment id' }, { status: 400 })
  }

  const mollie = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY })

  let payment: any
  try {
    payment = await mollie.payments.get(paymentId)
  } catch (err) {
    console.error('Mollie payment fetch failed:', err)
    // Return 200 so Mollie doesn't retry forever; the operator can replay.
    return NextResponse.json({ ok: false, error: 'fetch failed' })
  }

  // Look up the scan via the metadata we stamped at create-payment time.
  const scanId = Number(payment?.metadata?.scan_id)
  if (!Number.isFinite(scanId)) {
    console.error('Mollie webhook: scan_id missing from metadata', payment?.metadata)
    return NextResponse.json({ ok: false, error: 'no scan_id metadata' })
  }

  const scanRow = (await sql<{
    id: number, client_email: string|null, client_first_name: string|null,
    client_last_name: string|null, deposit_paid_at: string|null,
    deposit_coupon_code: string|null, session_id: string,
  }>`
    SELECT id, client_email, client_first_name, client_last_name,
           deposit_paid_at, deposit_coupon_code, session_id
    FROM ai_scans WHERE id = ${scanId} LIMIT 1
  `).rows[0]
  if (!scanRow) {
    console.error('Mollie webhook: scan not found', scanId)
    return NextResponse.json({ ok: false, error: 'scan not found' })
  }

  // Idempotency: if we already marked this deposit paid, do not re-issue
  // another coupon or email.
  if (scanRow.deposit_paid_at) {
    return NextResponse.json({ ok: true, already: true })
  }

  if (payment.status !== 'paid') {
    return NextResponse.json({ ok: true, status: payment.status, note: 'not paid yet' })
  }

  // 1. Generate a unique coupon code. Tiny collision chance per attempt, retry
  //    up to 5 times if WooCommerce rejects with duplicate.
  let couponCode = scanRow.deposit_coupon_code
  if (!couponCode) {
    for (let attempt = 0; attempt < 5 && !couponCode; attempt++) {
      const candidate = randomCouponCode()
      const result = await createWooCoupon({
        code:          candidate,
        discount_type: 'fixed_cart',
        amount:        '35.00',
        description:   `Atelier AI scan deposit credit (Gravida Scan session ${scanRow.session_id})`,
        individual_use: false,
        usage_limit:   1,
        email_restrictions: scanRow.client_email ? [scanRow.client_email] : undefined,
        minimum_amount: '35.00',
      })
      if (result.ok) {
        couponCode = candidate
      } else if (!/duplicate|exists/i.test(result.error ?? '')) {
        // Hard error, abort the coupon path — we still mark the deposit paid
        // so Laila can manually issue a code from the admin.
        console.error('Coupon create failed (non-duplicate):', result.error)
        break
      }
    }
  }

  await sql`
    UPDATE ai_scans
       SET deposit_paid_at     = NOW(),
           deposit_coupon_code = ${couponCode}
     WHERE id = ${scanRow.id}
  `

  // 2. Send confirmation email if we have the customer's address.
  if (scanRow.client_email && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const from = (process.env.EMAIL_FROM ?? 'Gravida <hi@gravida.nl>').trim()
      const voornaam = (scanRow.client_first_name ?? '').trim() || 'jij'
      await resend.emails.send({
        from,
        to: scanRow.client_email,
        subject: 'Je sculptuur is gereserveerd, Atelier Gravida',
        html: `
          <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2a1f;">
            <h1 style="font-size:22px;color:#3d5c41;">Bedankt, ${voornaam}.</h1>
            <p style="font-size:15px;line-height:1.7;">
              Je &euro;35 aanbetaling is binnen, en je sculptuur is gereserveerd. Het volledige bedrag staat in de Atelier-administratie als krediet op jouw bestelling.
            </p>
            ${couponCode ? `
              <p style="font-size:11px;font-weight:600;color:#7a8e7c;text-transform:uppercase;letter-spacing:1px;margin:24px 0 8px;">Jouw kredietcode</p>
              <p style="font-family:'Courier New',monospace;font-size:22px;font-weight:700;color:#3d5c41;letter-spacing:.04em;margin:0 0 8px;">${couponCode}</p>
              <p style="font-size:13px;color:#7a8e7c;margin:0 0 24px;">Verzilver deze bij het afrekenen op studiogravida.com, het bedrag wordt automatisch verrekend met je bestelling.</p>
            ` : `
              <p style="font-size:13px;color:#7a8e7c;margin:24px 0;">Laila stuurt je binnen een dag jouw persoonlijke kredietcode.</p>
            `}
            <p style="font-size:15px;line-height:1.7;">Wat hierna gebeurt: ons team digitale beeldhouwers werkt door op de basis die de AI vanuit jouw foto's heeft gemaakt. Laila neemt binnen een dag persoonlijk contact met je op voor afstemming.</p>
            <p style="font-size:15px;line-height:1.7;margin:24px 0 0;">Een warme groet,<br/><strong>Laila</strong><br/><span style="color:#7a8e7c;font-size:13px;">Atelier Gravida, Haarlem</span></p>
          </div>
        `,
      })
    } catch (err) {
      console.error('Deposit confirmation email failed:', err)
    }
  }

  return NextResponse.json({ ok: true, coupon: couponCode })
}
