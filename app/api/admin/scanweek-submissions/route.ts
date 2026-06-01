import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.GRAVIDA_SITE_URL ?? 'https://gravida-new.vercel.app'
const SECRET = process.env.GRAVIDA_SITE_SECRET ?? ''

export async function GET() {
  if (!SECRET) {
    return NextResponse.json({ error: 'GRAVIDA_SITE_SECRET niet ingesteld' }, { status: 500 })
  }
  try {
    const url = `${SITE_URL}/api/admin/scanweek-submissions?secret=${encodeURIComponent(SECRET)}`
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
    const { id, status, note } = body as { id: string; status?: string; note?: string }
    if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })

    const url = `${SITE_URL}/api/admin/scanweek-submissions`
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, note, secret: SECRET }),
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
