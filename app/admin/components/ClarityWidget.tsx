'use client'

import { useEffect, useState } from 'react'

interface ClarityMetric {
  metricName: string
  information: Array<Record<string, string | number>>
}

interface ApiResponse {
  configured: boolean
  metrics?: ClarityMetric[]
  fetched_at?: string
  from_cache?: boolean
  warning?: string
  error?: string
}

function pickNumber(obj: Record<string, string | number> | undefined, ...keys: string[]): number {
  if (!obj) return 0
  for (const k of keys) {
    if (k in obj) {
      const v = obj[k]
      const n = typeof v === 'number' ? v : parseFloat(String(v))
      if (!Number.isNaN(n)) return n
    }
  }
  return 0
}

function fmtNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(Math.round(n))
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

export default function ClarityWidget() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (force = false) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/clarity-stats${force ? '?force=1' : ''}`, { credentials: 'include' })
      const d = await r.json()
      setData(d)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  if (loading && !data) {
    return (
      <div className="card">
        <p className="text-sm text-gravida-light-sage">📊 Bezoekersstatistieken laden...</p>
      </div>
    )
  }

  if (!data?.configured) {
    return (
      <div className="card bg-amber-50/40 border-amber-200">
        <h2 className="section-title">📊 Bezoekersstatistieken</h2>
        <p className="text-xs text-amber-800 mt-2">
          Clarity API token nog niet ingesteld. Maak hem aan via{' '}
          <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" className="underline">
            clarity.microsoft.com
          </a>{' '}→ project → Settings → Data Export → <strong>Generate new API token</strong>, en zet de waarde in Vercel als{' '}
          <code className="bg-amber-100 px-1 rounded">CLARITY_API_TOKEN</code>.
        </p>
      </div>
    )
  }

  if (data.error && !data.metrics) {
    return (
      <div className="card bg-red-50 border-red-200">
        <h2 className="section-title">📊 Bezoekersstatistieken</h2>
        <p className="text-xs text-red-700 mt-2">{data.error}</p>
      </div>
    )
  }

  const metrics = data.metrics ?? []
  const traffic = metrics.find(m => m.metricName === 'Traffic')?.information[0]
  const sessions = pickNumber(traffic, 'totalSessionCount', 'sessions')
  const users = pickNumber(traffic, 'distinctUserCount', 'distinctUsers')
  const pageViews = pickNumber(traffic, 'pagesPerSessionPercentage', 'pageviews', 'pageViews')
  const bots = pickNumber(traffic, 'botSessionCount', 'botSessions')

  const engaged = metrics.find(m => m.metricName === 'EngagementTime')?.information[0]
  const engagedTime = pickNumber(engaged, 'totalTime', 'averageEngagementTime')

  const scrollDepth = metrics.find(m => m.metricName === 'ScrollDepth')?.information[0]
  const avgScroll = pickNumber(scrollDepth, 'averageScrollDepth', 'totalScrollDepth')

  const rageClicks = metrics.find(m => m.metricName === 'RageClickCount')?.information[0]
  const rageClickPct = pickNumber(rageClicks, 'subTotal', 'pagesWithRageClicksPercent')

  const deadClicks = metrics.find(m => m.metricName === 'DeadClickCount')?.information[0]
  const deadClickPct = pickNumber(deadClicks, 'subTotal', 'pagesWithDeadClicksPercent')

  const quickBacks = metrics.find(m => m.metricName === 'QuickbackClick')?.information[0]
  const quickBackPct = pickNumber(quickBacks, 'subTotal', 'pagesWithQuickbacksPercent')

  const cardClass = 'bg-white border border-gravida-cream rounded-xl p-3'

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="section-title">📊 Bezoekersstatistieken</h2>
          <p className="text-[11px] text-gravida-light-sage">
            Laatste 3 dagen ·{' '}
            {data.fetched_at && (
              <span>Bijgewerkt {new Date(data.fetched_at).toLocaleString('nl-NL')}</span>
            )}{' '}
            {data.from_cache && <span className="opacity-70">(gecached)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} disabled={loading}
            className="text-xs px-2 py-1 rounded bg-gravida-cream text-gravida-sage hover:bg-gravida-off-white disabled:opacity-50">
            {loading ? 'Bezig...' : '↻ Ververs'}
          </button>
          <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer"
            className="text-xs px-2 py-1 rounded bg-gravida-sage text-white hover:bg-gravida-green">
            Volledig dashboard ↗
          </a>
        </div>
      </div>

      {data.warning && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
          ⚠ {data.warning}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Sessies" value={fmtNum(sessions)} cls={cardClass} />
        <Stat label="Unieke bezoekers" value={fmtNum(users)} cls={cardClass} />
        <Stat label="Engagement (sec gem.)" value={fmtNum(engagedTime)} cls={cardClass} />
        <Stat label="Scroll diepte" value={fmtPct(avgScroll)} cls={cardClass} />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        <Stat label="Rage clicks" value={fmtPct(rageClickPct)} cls={cardClass} warn={rageClickPct > 5} />
        <Stat label="Dead clicks" value={fmtPct(deadClickPct)} cls={cardClass} warn={deadClickPct > 5} />
        <Stat label="Quick backs" value={fmtPct(quickBackPct)} cls={cardClass} warn={quickBackPct > 10} />
      </div>

      {bots > 0 && (
        <p className="text-[11px] text-gravida-light-sage mt-2">
          🤖 {fmtNum(bots)} bot-sessies uitgesloten van bovenstaande cijfers
        </p>
      )}

      <p className="text-[10px] text-gravida-light-sage mt-3">
        Tip: Rage clicks &gt; 5% of dead clicks &gt; 5% wijst op UX problemen op die pagina. Klik &quot;Volledig dashboard&quot; voor recordings + heatmaps.
      </p>
    </div>
  )
}

function Stat({ label, value, cls, warn }: { label: string; value: string; cls: string; warn?: boolean }) {
  return (
    <div className={cls}>
      <p className="text-[10px] text-gravida-light-sage uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${warn ? 'text-amber-600' : 'text-gravida-green'}`}>{value}</p>
    </div>
  )
}
