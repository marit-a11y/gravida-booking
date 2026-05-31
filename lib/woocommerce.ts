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

export interface WooOrderLine {
  id: number
  name: string
  product_id: number
  quantity: number
  subtotal: string
  total: string
  sku?: string
}

export interface WooOrder {
  id: number
  number: string
  status: string
  currency: string
  date_created: string
  date_modified: string
  date_paid: string | null
  total: string
  total_tax: string
  shipping_total: string
  discount_total: string
  payment_method_title: string
  customer_note?: string
  billing: {
    first_name: string
    last_name: string
    email: string
    phone: string
    address_1: string
    address_2: string
    postcode: string
    city: string
    country: string
  }
  shipping: {
    first_name: string
    last_name: string
    address_1: string
    address_2: string
    postcode: string
    city: string
    country: string
  }
  line_items: WooOrderLine[]
  coupon_lines?: { code: string; discount: string }[]
}

export interface WooOrdersResult {
  ok: boolean
  orders?: WooOrder[]
  totalPages?: number
  totalCount?: number
  error?: string
}

interface WooOrdersQuery {
  page?: number
  perPage?: number
  status?: string
  search?: string
  after?: string  // ISO datum
  before?: string
}

export async function getWooOrders(q: WooOrdersQuery = {}): Promise<WooOrdersResult> {
  if (!isWooCommerceConfigured()) {
    return { ok: false, error: 'WooCommerce niet geconfigureerd (zet WOOCOMMERCE_URL, WOOCOMMERCE_KEY, WOOCOMMERCE_SECRET in Vercel env)' }
  }
  const base = process.env.WOOCOMMERCE_URL!.replace(/\/$/, '')
  const params = new URLSearchParams()
  params.set('page', String(q.page ?? 1))
  params.set('per_page', String(q.perPage ?? 25))
  if (q.status && q.status !== 'all') params.set('status', q.status)
  if (q.search) params.set('search', q.search)
  if (q.after) params.set('after', q.after)
  if (q.before) params.set('before', q.before)
  params.set('orderby', 'date')
  params.set('order', 'desc')

  try {
    const res = await fetch(`${base}/wp-json/wc/v3/orders?${params.toString()}`, {
      headers: { Authorization: authHeader() },
      cache: 'no-store',
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `WC API gaf ${res.status}: ${text.slice(0, 300)}` }
    }
    const totalPages = parseInt(res.headers.get('x-wp-totalpages') ?? '1', 10)
    const totalCount = parseInt(res.headers.get('x-wp-total') ?? '0', 10)
    const orders = (await res.json()) as WooOrder[]
    return { ok: true, orders, totalPages, totalCount }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function getWooOrder(id: number): Promise<{ ok: boolean; order?: WooOrder; error?: string }> {
  if (!isWooCommerceConfigured()) return { ok: false, error: 'WooCommerce niet geconfigureerd' }
  const base = process.env.WOOCOMMERCE_URL!.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/wp-json/wc/v3/orders/${id}`, {
      headers: { Authorization: authHeader() },
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: `WC API gaf ${res.status}` }
    const order = (await res.json()) as WooOrder
    return { ok: true, order }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
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
