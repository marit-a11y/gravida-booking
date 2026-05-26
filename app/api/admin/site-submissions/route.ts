import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Proxy naar gravida.nl/api/admin/submissions zodat de admin-secret veilig
// server-side blijft en niet in de browser komt.

const SITE_URL = process.env.GRAVIDA_SITE_URL ?? 'https://gravida.nl'
const SECRET = process.env.GRAVIDA_SITE_SECRET ?? ''

export async function GET() {
  if (!SECRET) {
    return NextResponse.json({
      error: 'GRAVIDA_SITE_SECRET niet ingesteld in Vercel env vars',
    }, { status: 500 })
  }
  try {
    const url = `${SITE_URL}/api/admin/submissions?secret=${encodeURIComponent(SECRET)}`
    const r = await fetch(url, { cache: 'no-store' })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return NextResponse.json({ error: data?.error ?? `Site gaf status ${r.status}` }, { status: r.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Verbinding met site mislukt: ' + String(err) }, { status: 502 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!SECRET) {
    return NextResponse.json({ error: 'GRAVIDA_SITE_SECRET niet ingesteld' }, { status: 500 })
  }
  try {
    const body = await request.json()
    const { id, status } = body as { id: string; status: 'approved' | 'rejected' }
    if (!id || !status) return NextResponse.json({ error: 'id en status verplicht' }, { status: 400 })

    const url = `${SITE_URL}/api/admin/submissions`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, secret: SECRET }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) {
      return NextResponse.json({ error: data?.error ?? `Site gaf status ${r.status}` }, { status: r.status })
    }
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'Verbinding met site mislukt: ' + String(err) }, { status: 502 })
  }
}
