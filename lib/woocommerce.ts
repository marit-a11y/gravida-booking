/**
 * WooCommerce REST API helper.
 *
 * Required env vars:
 *  - WOOCOMMERCE_URL     Bv. https://gravida.nl (zonder trailing slash)
 *  - WOOCOMMERCE_KEY     Consumer key (ck_...)
 *  - WOOCOMMERCE_SECRET  Consumer secret (cs_...)
 *
 * Keys aanmaken: WP Admin → WooCommerce → Settings → Advanced →
 * REST API → Add key. Permissions: Read/Write.
 *
 * Als de env vars niet ingesteld zijn, faalt elke functie stil
 * (logt enkel) zodat de bovenliggende flow blijft werken.
 */

export function isWooCommerceConfigured(): boolean {
  return !!(process.env.WOOCOMMERCE_URL && process.env.WOOCOMMERCE_KEY && process.env.WOOCOMMERCE_SECRET)
}

function authHeader(): string {
  const key = process.env.WOOCOMMERCE_KEY!
  const secret = process.env.WOOCOMMERCE_SECRET!
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

interface WooCouponInput {
  code: string
  discount_type?: 'fixed_cart' | 'fixed_product' | 'percent'
  amount: string          // bedrag als string, bv. "200.00"
  description?: string
  individual_use?: boolean
  usage_limit?: number    // hoe vaak gebruikt mag worden, default 1
  date_expires?: string   // ISO datum
  email_restrictions?: string[]  // alleen voor deze email-adressen
  minimum_amount?: string
}

export async function createWooCoupon(input: WooCouponInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  if (!isWooCommerceConfigured()) {
    console.warn('WooCommerce env vars not set, skipping coupon create')
    return { ok: false, error: 'not configured' }
  }
  const url = `${process.env.WOOCOMMERCE_URL!.replace(/\/$/, '')}/wp-json/wc/v3/coupons`

  const body = {
    code: input.code,
    discount_type: input.discount_type ?? 'fixed_cart',
    amount: input.amount,
    description: input.description ?? '',
    individual_use: input.individual_use ?? false,
    usage_limit: input.usage_limit ?? 1,
    date_expires: input.date_expires,
    email_restrictions: input.email_restrictions,
    minimum_amount: input.minimum_amount ?? '0.00',
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('WooCommerce coupon create failed:', data)
      return { ok: false, error: JSON.stringify(data) }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('WooCommerce coupon create exception:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
