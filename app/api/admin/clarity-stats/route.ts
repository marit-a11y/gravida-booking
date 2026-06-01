import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { fetchClarityInsights, isClarityConfigured, type ClarityMetric } from '@/lib/clarity'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const CACHE_KEY = 'insights-3d'
const CACHE_TTL_MS = 2 * 60 * 60 * 1000  // 2 uur (vanwege 10 calls/dag limiet)

interface CacheRow { payload: ClarityMetric[]; fetched_at: string }

async function getCached(): Promise<{ data: ClarityMetric[]; fetchedAt: Date } | null> {
  const r = await sql<CacheRow>`SELECT payload, fetched_at::text FROM clarity_cache WHERE cache_key = ${CACHE_KEY}`
  if (r.rows.length === 0) return null
  return {
    data: r.rows[0].payload as unknown as ClarityMetric[],
    fetchedAt: new Date(r.rows[0].fetched_at),
  }
}

async function setCache(data: ClarityMetric[]) {
  await sql`
    INSERT INTO clarity_cache (cache_key, payload, fetched_at)
    VALUES (${CACHE_KEY}, ${JSON.stringify(data)}::jsonb, NOW())
    ON CONFLICT (cache_key) DO UPDATE
    SET payload = EXCLUDED.payload, fetched_at = NOW()
  `
}

export async function GET(request: NextRequest) {
  if (!isClarityConfigured()) {
    return NextResponse.json({
      configured: false,
      error: 'CLARITY_API_TOKEN niet ingesteld. Zet in Vercel env vars (waarde van clarity.microsoft.com → Settings → Data Export → Generate new API token).',
    })
  }

  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === '1'

  const cached = await getCached()
  const now = Date.now()
  const isFresh = cached && (now - cached.fetchedAt.getTime() < CACHE_TTL_MS)

  if (cached && isFresh && !force) {
    return NextResponse.json({
      configured: true,
      metrics: cached.data,
      fetched_at: cached.fetchedAt.toISOString(),
      from_cache: true,
    })
  }

  // Refresh (respecteert het 10/dag limiet via TTL)
  // dimension1=Source geeft per-metric een breakdown per verkeersbron én
  // we kunnen daar de totalen uit afleiden. Dat scheelt een extra API call.
  const res = await fetchClarityInsights({ numOfDays: 3, dimension1: 'Source' })
  if (!res.ok || !res.metrics) {
    // Geef oude cache terug met waarschuwing
    if (cached) {
      return NextResponse.json({
        configured: true,
        metrics: cached.data,
        fetched_at: cached.fetchedAt.toISOString(),
        from_cache: true,
        warning: 'Live data ophalen mislukt — toon laatste cache: ' + res.error,
      })
    }
    return NextResponse.json({ configured: true, error: res.error }, { status: 502 })
  }
  await setCache(res.metrics)
  return NextResponse.json({
    configured: true,
    metrics: res.metrics,
    fetched_at: new Date().toISOString(),
    from_cache: false,
  })
}
