import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SETUP_KEY = process.env.SETUP_KEY ?? ''

function wooAuthHeader() {
  const key = process.env.WOOCOMMERCE_KEY!
  const secret = process.env.WOOCOMMERCE_SECRET!
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

function wooBase() {
  return (process.env.WOOCOMMERCE_URL ?? '').replace(/\/$/, '')
}

function removeDashes(text: string): string {
  // Replace em-dash and en-dash with comma + space (or just strip if at start/end)
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ' tot ')
    .replace(/,\s*,/g, ',') // clean up double commas
    .trim()
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

// GET: show current product descriptions
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Search for products with afdruk in the name or description
  const r = await wooFetch('/products?search=afdruk&per_page=20')
  if (!r.ok) {
    return NextResponse.json({ error: 'WC fetch failed', status: r.status, data: r.data })
  }

  const products = (r.data as Array<{ id: number; name: string; description: string; short_description: string; slug: string }>)
  const result = products.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    short_description: p.short_description,
    has_emdash: p.description.includes('—') || p.short_description.includes('—'),
    has_endash: p.description.includes('–') || p.short_description.includes('–'),
  }))

  return NextResponse.json({ products: result })
}

// POST: fix dashes in product descriptions
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const productId = body.id as number
  if (!productId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Fetch current product
  const r = await wooFetch(`/products/${productId}`)
  if (!r.ok) return NextResponse.json({ error: 'Product not found', data: r.data }, { status: 404 })

  const product = r.data as { id: number; name: string; description: string; short_description: string }
  const newDesc = removeDashes(product.description)
  const newShort = removeDashes(product.short_description)

  const update = await wooFetch(`/products/${productId}`, 'PUT', {
    description: newDesc,
    short_description: newShort,
  })

  return NextResponse.json({
    ok: update.ok,
    id: productId,
    name: product.name,
    old_description: product.description,
    new_description: newDesc,
    old_short: product.short_description,
    new_short: newShort,
  })
}
