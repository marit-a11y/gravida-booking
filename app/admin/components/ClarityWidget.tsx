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

function sumRows(rows: Array<Record<string, string | number>> | undefined, ...keys: string[]): number {
  if (!rows) return 0
  return rows.reduce((s, r) => s + pickNumber(r, ...keys), 0)
}

function weightedAvgRows(
  rows: Array<Record<string, string | number>> | undefined,
  valueKeys: string[],
  weightKeys: string[],
): number {
  if (!rows || rows.length === 0) return 0
  let totalW = 0, totalVW = 0
  for (const r of rows) {
    const v = pickNumber(r, ...valueKeys)
    const w = pickNumber(r, ...weightKeys) || 1
    totalVW += v * w
    totalW += w
  }
  return totalW > 0 ? totalVW / totalW : 0
}

// Normaliseer source naam zodat 'google.com' en 'https://www.google.com' samen worden gegroepeerd
function normSource(raw: string): { label: string; group: string } {
  const s = (raw || '').toString().trim().toLowerCase()
  if (!s || s === 'direct' || s === '(direct)' || s === 'none') return { label: 'Direct / app', group: 'direct' }
  // strip protocol + www
  const host = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  if (!host) return { label: 'Direct / app', group: 'direct' }
  // Groepeer bekende bronnen
  if (host.includes('google')) return { label: 'Google', group: 'google' }
  if (host.includes('bing') || host.includes('msn') || host.includes('yahoo') || host.includes('duckduckgo')) return { label: host, group: 'other-search' }
  if (host.includes('instagram') || host.includes('l.instagram') || host.includes('lm.facebook') || host.includes('facebook') || host.includes('fb.com')) {
    return { label: host.includes('insta') ? 'Instagram' : 'Facebook', group: 'social' }
  }
  if (host.includes('tiktok')) return { label: 'TikTok', group: 'social' }
  if (host.includes('pinterest')) return { label: 'Pinterest', group: 'social' }
  if (host.includes('youtube') || host.includes('youtu.be')) return { label: 'YouTube', group: 'social' }
  if (host.includes('linkedin')) return { label: 'LinkedIn', group: 'social' }
  if (host.includes('whatsapp') || host.includes('wa.me')) return { label: 'WhatsApp', group: 'messaging' }
  if (host.includes('gmail') || host.includes('outlook') || host.includes('mail.')) return { label: 'E-mail', group: 'email' }
  return { label: host, group: 'referral' }
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
  const trafficRows = metrics.find(m => m.metricName === 'Traffic')?.information
  // Met dimension1=Source bestaat trafficRows uit één rij per bron — som over rijen
  const sessions = sumRows(trafficRows, 'totalSessionCount', 'sessions')
  const users = sumRows(trafficRows, 'distinctUserCount', 'distinctUsers')
  const bots = sumRows(trafficRows, 'botSessionCount', 'botSessions')

  const engagedRows = metrics.find(m => m.metricName === 'EngagementTime')?.information
  const engagedTime = weightedAvgRows(engagedRows, ['averageEngagementTime', 'totalTime'], ['totalSessionCount', 'sessions'])

  const scrollRows = metrics.find(m => m.metricName === 'ScrollDepth')?.information
  const avgScroll = weightedAvgRows(scrollRows, ['averageScrollDepth', 'totalScrollDepth'], ['totalSessionCount', 'sessions'])

  const rageRows = metrics.find(m => m.metricName === 'RageClickCount')?.information
  const rageClickPct = weightedAvgRows(rageRows, ['subTotal', 'pagesWithRageClicksPercent'], ['totalSessionCount', 'sessions'])

  const deadRows = metrics.find(m => m.metricName === 'DeadClickCount')?.information
  const deadClickPct = weightedAvgRows(deadRows, ['subTotal', 'pagesWithDeadClicksPercent'], ['totalSessionCount', 'sessions'])

  const quickRows = metrics.find(m => m.metricName === 'QuickbackClick')?.information
  const quickBackPct = weightedAvgRows(quickRows, ['subTotal', 'pagesWithQuickbacksPercent'], ['totalSessionCount', 'sessions'])

  // Top bronnen: groepeer per source, sorteer op sessions
  const sourceMap = new Map<string, { label: string; sessions: number }>()
  for (const row of trafficRows ?? []) {
    const rawSource = (row.Source ?? row.source ?? '') as string
    const { label, group } = normSource(rawSource)
    const ses = pickNumber(row, 'totalSessionCount', 'sessions')
    const prev = sourceMap.get(group)
    if (prev) prev.sessions += ses
    else sourceMap.set(group, { label, sessions: ses })
  }
  const topSources = Array.from(sourceMap.values())
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8)
  const totalForSources = topSources.reduce((s, r) => s + r.sessions, 0) || 1

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

      {/* Verkeersbronnen */}
      {topSources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gravida-cream">
          <h3 className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide mb-2">
            🔗 Top verkeersbronnen
          </h3>
          <div className="space-y-1">
            {topSources.map((s, i) => {
              const pct = (s.sessions / totalForSources) * 100
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-28 text-gravida-green truncate" title={s.label}>{s.label}</span>
                  <div className="flex-1 bg-gravida-cream rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gravida-sage" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-12 text-right text-gravida-sage">{fmtNum(s.sessions)}</span>
                  <span className="w-10 text-right text-gravida-light-sage">{Math.round(pct)}%</span>
                </div>
              )
            })}
          </div>
        </div>
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
