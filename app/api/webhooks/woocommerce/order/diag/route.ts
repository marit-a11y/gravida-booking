import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Diag-endpoint voor de WC webhook signature.
 * Geeft terug of de env var is geladen + lengte/eerste/laatste teken
 * zodat we matching kunnen vergelijken met de waarde in WP, zonder
 * het echte secret te onthullen.
 */
export async function GET() {
  const SECRET = process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? ''
  return NextResponse.json({
    secret_set: SECRET.length > 0,
    secret_length: SECRET.length,
    first_char: SECRET.charAt(0) || null,
    last_char: SECRET.charAt(SECRET.length - 1) || null,
    has_leading_space: /^\s/.test(SECRET),
    has_trailing_space: /\s$/.test(SECRET),
    webhook_url: 'https://dashboard.gravida.nl/api/webhooks/woocommerce/order',
    info: 'Zelfde waarde moet in WP Admin → WooCommerce → Settings → Advanced → Webhooks → Edit → "Secret" staan',
  })
}
