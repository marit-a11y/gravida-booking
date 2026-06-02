import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Simuleert een WooCommerce-order-update naar onze eigen webhook.
 * Bouwt een geldig payload + signature met WOOCOMMERCE_WEBHOOK_SECRET
 * en POST'd naar /api/webhooks/woocommerce/order.
 *
 * Gebruik: POST { code: 'GRAVI-LWBR-LD34', order_number?: 'TEST-1' }
 */
export async function POST(request: NextRequest) {
  const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? ''
  if (!secret) {
    return NextResponse.json({ error: 'WOOCOMMERCE_WEBHOOK_SECRET niet ingesteld' }, { status: 500 })
  }

  const body = await request.json()
  const code = (body.code ?? '').toString().trim()
  if (!code) return NextResponse.json({ error: 'code verplicht' }, { status: 400 })
  const orderNumber = body.order_number ?? `TEST-${Date.now().toString().slice(-6)}`

  const payload = {
    id: Math.floor(Math.random() * 1000000),
    number: orderNumber,
    status: 'processing',
    billing: {
      first_name: 'Test',
      last_name: 'Klant',
      email: 'test@example.com',
    },
    coupon_lines: [{ code, discount: '200.00' }],
  }
  const rawBody = JSON.stringify(payload)
  const sig = crypto.createHmac('sha256', secret).update(rawBody).digest('base64')

  // Bepaal het host-protocol om naar onszelf te POSTen
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('host') ?? 'dashboard.gravida.nl'
  const url = `${proto}://${host}/api/webhooks/woocommerce/order`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-WC-Webhook-Signature': sig,
      'X-WC-Webhook-Topic': 'order.updated',
      'X-WC-Webhook-Source': proto + '://' + host,
      'User-Agent': 'TestSimulator/1.0',
    },
    body: rawBody,
  })
  const data = await res.json().catch(() => ({}))
  return NextResponse.json({
    sent_to: url,
    sent_body: payload,
    response_status: res.status,
    response: data,
  })
}
