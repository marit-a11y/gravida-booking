import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SETUP_KEY = process.env.SETUP_KEY ?? ''
const DIY_PRODUCT_ID = 8397

function wooAuthHeader() {
  const key = process.env.WOOCOMMERCE_KEY!
  const secret = process.env.WOOCOMMERCE_SECRET!
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

function wooBase() {
  return (process.env.WOOCOMMERCE_URL ?? '').replace(/\/$/, '')
}

async function wooFetch(path: string, method = 'GET', body?: object) {
  const base = wooBase()
  const res = await fetch(`${base}/wp-json/wc/v3${path}`, {
    method,
    headers: {
      Authorization: wooAuthHeader(),
      'Content-Type': 'application/json',
      'User-Agent': 'Gravida-Dashboard/1.0',
      Accept: 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// GET: show current state (categories + upsells of DIY product, and all sieraden)
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Get the sieraden category
  const catR = await wooFetch('/products/categories?slug=sieraden&per_page=5')
  const cats = catR.data as Array<{ id: number; name: string; slug: string }>
  const sieradenCat = Array.isArray(cats) ? cats[0] : null

  // 2. Get sieraden products
  let sieradenProducts: Array<{ id: number; name: string }> = []
  if (sieradenCat) {
    const prodR = await wooFetch(`/products?category=${sieradenCat.id}&per_page=20&status=publish`)
    sieradenProducts = (prodR.data as Array<{ id: number; name: string; status: string }>)
      .map(p => ({ id: p.id, name: p.name }))
  }

  // 3. Get current DIY product upsells
  const diyR = await wooFetch(`/products/${DIY_PRODUCT_ID}`)
  const diy = diyR.data as { id: number; name: string; upsell_ids: number[]; related_ids: number[]; categories: Array<{ id: number; name: string }> }

  return NextResponse.json({
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
}

// POST: set sieraden products as upsells on the DIY afdrukset
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get sieraden category
  const catR = await wooFetch('/products/categories?slug=sieraden&per_page=5')
  const cats = catR.data as Array<{ id: number; name: string }>
  const sieradenCat = Array.isArray(cats) ? cats[0] : null

  if (!sieradenCat) {
    return NextResponse.json({ error: 'Sieraden categorie niet gevonden' }, { status: 404 })
  }

  // Get sieraden products
  const prodR = await wooFetch(`/products?category=${sieradenCat.id}&per_page=20&status=publish`)
  const sieradenIds = (prodR.data as Array<{ id: number }>).map(p => p.id)

  if (sieradenIds.length === 0) {
    return NextResponse.json({ error: 'Geen sieraden producten gevonden' }, { status: 404 })
  }

  // Update DIY product: set upsell_ids to sieraden products
  const updateR = await wooFetch(`/products/${DIY_PRODUCT_ID}`, 'PUT', {
    upsell_ids: sieradenIds,
  })

  return NextResponse.json({
    ok: updateR.ok,
    sieraden_ids: sieradenIds,
    result: updateR.data,
  })
}
