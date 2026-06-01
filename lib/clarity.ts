/**
 * Microsoft Clarity Data Export API wrapper.
 *
 * Vereiste env var:
 *   CLARITY_API_TOKEN  Personal API token vanuit
 *                      clarity.microsoft.com → Settings → Data Export → Generate new API token
 *
 * Belangrijk: het gratis tier heeft 10 API calls per project per dag.
 * Daarom cachen we resultaten in de DB voor 2 uur.
 */

export function isClarityConfigured(): boolean {
  return !!process.env.CLARITY_API_TOKEN
}

export interface ClarityMetric {
  metricName: string
  // De API geeft een array van rijen terug; iedere rij heeft metrics +
  // optioneel dimensie waarden. Bv. voor 'Traffic': sessions, distinctUsers.
  information: Array<Record<string, string | number>>
}

interface FetchOptions {
  numOfDays?: 1 | 2 | 3
  dimension1?: string
  dimension2?: string
  dimension3?: string
}

export async function fetchClarityInsights(opts: FetchOptions = {}): Promise<{ ok: boolean; metrics?: ClarityMetric[]; error?: string }> {
  const token = process.env.CLARITY_API_TOKEN
  if (!token) return { ok: false, error: 'CLARITY_API_TOKEN niet geconfigureerd' }

  const params = new URLSearchParams()
  params.set('numOfDays', String(opts.numOfDays ?? 3))
  if (opts.dimension1) params.set('dimension1', opts.dimension1)
  if (opts.dimension2) params.set('dimension2', opts.dimension2)
  if (opts.dimension3) params.set('dimension3', opts.dimension3)

  const url = `https://www.clarity.ms/export-data/api/v1/project-live-insights?${params.toString()}`
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return { ok: false, error: `Clarity API gaf ${r.status}: ${text.slice(0, 200)}` }
    }
    const data = (await r.json()) as ClarityMetric[]
    return { ok: true, metrics: data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
