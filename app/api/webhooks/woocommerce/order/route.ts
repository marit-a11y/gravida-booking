import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sql } from '@vercel/postgres'
import { getRecipientsForPage } from '@/lib/inbox-recipients'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * WooCommerce webhook ontvanger voor order events.
 *
 * Setup in WP Admin → WooCommerce → Settings → Advanced → Webhooks:
 *  - Topic: Order updated  (Order updated dekt zowel created als processing)
 *  - Delivery URL: https://dashboard.gravida.nl/api/webhooks/woocommerce/order
 *  - Secret: lange random string, ook in Vercel als WOOCOMMERCE_WEBHOOK_SECRET
 *
 * Wat we doen:
 *  1. Verifieer HMAC-signature (X-WC-Webhook-Signature header)
 *  2. Voor elke coupon op de order, zoek bijbehorende gift_card via code
 *  3. Mark as 'ingewisseld' (idempotent: niet nog een keer als al ingewisseld)
 *  4. Inbox-notif naar team
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? ''
  const rawBody = await request.text()

  // ── Signature check ────────────────────────────────────────────────────
  if (secret) {
    const sig = request.headers.get('x-wc-webhook-signature') ?? ''
    const source = request.headers.get('x-wc-webhook-source') ?? ''
    const topic = request.headers.get('x-wc-webhook-topic') ?? ''

    // Debug logging — kijk in Vercel function logs
    console.log('[WC webhook] incoming', {
      source,
      topic,
      sig_first8: sig.slice(0, 8),
      sig_length: sig.length,
      body_length: rawBody.length,
      body_first50: rawBody.slice(0, 50),
    })

    if (!sig) {
      console.warn('WC webhook: geen X-WC-Webhook-Signature header. Secret-veld in WP webhook leeg?')
      return NextResponse.json({
        error: 'Geen signature header. Vul Secret-veld in WP webhook in.',
      }, { status: 401 })
    }

    // Probeer drie verschillende body-representaties voor de HMAC, want
    // afhankelijk van WC versie / wp_json_encode wordt soms wel/niet getrimd
    // of komen er escape-verschillen voor.
    const candidates = [
      { name: 'raw', body: rawBody },
      { name: 'trimmed', body: rawBody.trim() },
    ]
    let matched: string | null = null
    let firstExpected = ''
    for (const c of candidates) {
      const expected = crypto.createHmac('sha256', secret).update(c.body).digest('base64')
      if (!firstExpected) firstExpected = expected
      const sigBuf = Buffer.from(sig)
      const expectedBuf = Buffer.from(expected)
      if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        matched = c.name
        break
      }
    }

    if (!matched) {
      console.warn('[WC webhook] signature mismatch', {
        sig_first8: sig.slice(0, 8),
        expected_first8: firstExpected.slice(0, 8),
        body_length: rawBody.length,
        body_trimmed_length: rawBody.trim().length,
      })
      return NextResponse.json({
        error: 'Signature mismatch. Check Vercel logs voor de eerste 8 tekens van de received vs expected signature.',
      }, { status: 401 })
    }
    console.log('[WC webhook] signature OK (via ' + matched + ')')
  } else {
    console.warn('WOOCOMMERCE_WEBHOOK_SECRET niet ingesteld — webhook draait zonder signature-check')
  }

  let payload: {
    id?: number
    number?: string
    status?: string
    billing?: { first_name?: string; last_name?: string; email?: string }
    coupon_lines?: Array<{ code?: string; discount?: string }>
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON body' }, { status: 400 })
  }

  const orderId = payload.id
  const orderNumber = payload.number ?? String(orderId ?? '?')
  const orderStatus = payload.status ?? ''
  const coupons = Array.isArray(payload.coupon_lines) ? payload.coupon_lines : []

  // We verwerken alleen orders die echt betaald zijn (niet draft/pending/cancelled/failed)
  const REDEEM_STATUSES = ['processing', 'completed', 'on-hold']
  if (!REDEEM_STATUSES.includes(orderStatus)) {
    return NextResponse.json({ ok: true, skipped: 'status=' + orderStatus })
  }

  const customerName = `${payload.billing?.first_name ?? ''} ${payload.billing?.last_name ?? ''}`.trim() || 'klant'
  const updated: { code: string; id: number; type: string; value: number }[] = []

  for (const cl of coupons) {
    const code = (cl.code ?? '').trim()
    if (!code) continue
    // WC stuurt codes in lowercase mee; we matchen case-insensitive
    const card = await sql<{ id: number; status: string; code: string; type: string; value_euros: string }>`
      SELECT id, status, code, type, value_euros::text
      FROM gift_cards
      WHERE LOWER(code) = LOWER(${code})
      LIMIT 1
    `
    if (card.rows.length === 0) continue
    const c = card.rows[0]
    if (c.status === 'ingewisseld') continue  // al gemarkeerd — idempotent

    await sql`
      UPDATE gift_cards
      SET status = 'ingewisseld',
          redeemed_at = NOW()
      WHERE id = ${c.id}
    `
    updated.push({ code: c.code, id: c.id, type: c.type, value: Number(c.value_euros) })
  }

  // Inbox-notif voor team (alleen als er iets gemarkeerd is)
  if (updated.length > 0) {
    const recipients = await getRecipientsForPage('cadeaubonnen')
    const lines = updated.map(u => {
      const label = u.type === 'borg_korting' ? 'borg-tegoed' : 'cadeaubon'
      return `• ${label} ${u.code} (€${u.value.toFixed(0)}) ingewisseld`
    }).join('\n')
    for (const recipient of recipients) {
      await sql`
        INSERT INTO inbox_items (recipient, type, title, body, link)
        VALUES (
          ${recipient},
          'woo_redemption',
          ${'🎁 Tegoed ingewisseld in webshop · order ' + orderNumber + ' van ' + customerName},
          ${lines + '\n\nOrder status: ' + orderStatus},
          '/admin/cadeaubonnen'
        )
      `.catch(err => console.error('Inbox notify error (woo redemption):', err))
    }
  }

  return NextResponse.json({
    ok: true,
    order: orderNumber,
    redeemed: updated.map(u => u.code),
  })
}
