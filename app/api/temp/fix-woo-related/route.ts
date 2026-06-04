import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SETUP_KEY = process.env.SETUP_KEY ?? ''
const DIY_PRODUCT_ID = 8397

function wooAuthHeader() {
  const key = process.env.WOOCOMMERCE_KEY ?? ''
  const secret = process.env.WOOCOMMERCE_SECRET ?? ''
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

function wooBase() {
  // wp.gravida.nl is the direct WordPress host (gravida.nl redirects to Vercel)
  const envUrl = (process.env.WOOCOMMERCE_URL ?? '').replace(/\/$/, '')
  if (envUrl && !envUrl.includes('wp.gravida.nl')) {
    // Override: always use wp.gravida.nl directly to avoid Vercel redirect loop
    return 'https://wp.gravida.nl'
  }
  return envUrl || 'https://wp.gravida.nl'
}

function authQueryString() {
  const key = process.env.WOOCOMMERCE_KEY ?? ''
  const secret = process.env.WOOCOMMERCE_SECRET ?? ''
  return `consumer_key=${encodeURIComponent(key)}&consumer_secret=${encodeURIComponent(secret)}`
}

async function wooFetch(path: string, method = 'GET', body?: object) {
  const base = wooBase()
  const sep = path.includes('?') ? '&' : '?'
  // Include query-string auth as belt-and-suspenders (works even if WAF strips Authorization header)
  const url = `${base}/wp-json/wc/v3${path}${sep}${authQueryString()}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: wooAuthHeader(),
      'Content-Type': 'application/json',
      'User-Agent': 'Gravida-Dashboard/1.0 (+https://dashboard.gravida.nl)',
      Accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// GET: show current state
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const configured = !!(process.env.WOOCOMMERCE_KEY && process.env.WOOCOMMERCE_SECRET)
    if (!configured) return NextResponse.json({ error: 'WooCommerce key/secret env vars not set', configured })

    const catR = await wooFetch('/products/categories?slug=sieraden&per_page=5')
    const cats = catR.data as Array<{ id: number; name: string; slug: string }>
    const sieradenCat = Array.isArray(cats) ? cats[0] : null

    let sieradenProducts: Array<{ id: number; name: string }> = []
    if (sieradenCat) {
      const prodR = await wooFetch(`/products?category=${sieradenCat.id}&per_page=20&status=publish`)
      sieradenProducts = (prodR.data as Array<{ id: number; name: string }>)
        .map(p => ({ id: p.id, name: p.name }))
    }

    const diyR = await wooFetch(`/products/${DIY_PRODUCT_ID}`)
    const diy = diyR.data as { id: number; name: string; upsell_ids: number[]; related_ids: number[]; categories: Array<{ id: number; name: string }> }

    return NextResponse.json({
      woo_base_used: wooBase(),
      sieraden_category: sieradenCat,
      sieraden_products: sieradenProducts,
      diy_product: {
        id: diy.id,
        name: diy.name,
        current_upsell_ids: diy.upsell_ids,
        current_related_ids: diy.related_ids,
        categories: diy.categories,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: set sieraden products as upsells on the DIY afdrukset
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const configured = !!(process.env.WOOCOMMERCE_URL && process.env.WOOCOMMERCE_KEY && process.env.WOOCOMMERCE_SECRET)
    if (!configured) return NextResponse.json({ error: 'WooCommerce env vars not set' }, { status: 500 })

    const catR = await wooFetch('/products/categories?slug=sieraden&per_page=5')
    const cats = catR.data as Array<{ id: number; name: string }>
    const sieradenCat = Array.isArray(cats) ? cats[0] : null
    if (!sieradenCat) return NextResponse.json({ error: 'Sieraden categorie niet gevonden' }, { status: 404 })

    const prodR = await wooFetch(`/products?category=${sieradenCat.id}&per_page=20&status=publish`)
    const sieradenIds = (prodR.data as Array<{ id: number }>)
      .map(p => p.id)
      .filter(id => id !== DIY_PRODUCT_ID)

    if (sieradenIds.length === 0) return NextResponse.json({ error: 'Geen sieraden producten gevonden' }, { status: 404 })

    const updateR = await wooFetch(`/products/${DIY_PRODUCT_ID}`, 'PUT', { upsell_ids: sieradenIds })

    return NextResponse.json({ ok: updateR.ok, sieraden_ids: sieradenIds, wc_status: updateR.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
