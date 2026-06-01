'use client'

import { useEffect, useMemo, useState } from 'react'

interface Submission {
  id: string
  email: string
  name?: string | null
  due_date?: string | null
  phone?: string | null
  region?: string | null
  status: 'pending' | 'contacted' | 'booked' | 'dismissed'
  note?: string | null
  timestamp: string
}

const STATUS_LABELS: Record<Submission['status'], { label: string; cls: string }> = {
  pending:   { label: 'Wachtend',     cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  contacted: { label: 'Gecontacteerd', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  booked:    { label: 'Geboekt',      cls: 'bg-green-100 text-green-700 border-green-200' },
  dismissed: { label: 'Afgesloten',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function weekFromDueDate(due: string | null | undefined, ref = new Date()): number | null {
  if (!due) return null
  const d = new Date(due)
  if (isNaN(d.getTime())) return null
  // Een zwangerschap = 40 weken vanaf 1 dag voor 38 weken. Bereken huidige zwangerschapsweek.
  // EDD = due date. Zwanger begin ≈ EDD minus 280 dagen.
  const lmp = new Date(d.getTime() - 280 * 86400000)
  const days = Math.floor((ref.getTime() - lmp.getTime()) / 86400000)
  if (days < 0) return null
  return Math.floor(days / 7)
}

function fmtDue(due: string | null | undefined): string {
  if (!due) return '—'
  const d = new Date(due)
  if (isNaN(d.getTime())) return due
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ScanweekPage() {
  const [items, setItems] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Submission['status']>('pending')
  const [updating, setUpdating] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/admin/scanweek-submissions', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) { setError(d?.error ?? 'Laden mislukt'); setItems([]) }
      else setItems(d.submissions ?? [])
    } catch (e) {
      setError(String(e))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: Submission['status']) => {
    setUpdating(id)
    try {
      const r = await fetch('/api/admin/scanweek-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (r.ok) setItems(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      else {
        const d = await r.json().catch(() => ({}))
        alert('Fout: ' + (d?.error ?? 'wijziging mislukt'))
      }
    } finally { setUpdating(null) }
  }

  const filtered = filter === 'all' ? items : items.filter(s => s.status === filter)
  const counts = {
    pending:   items.filter(s => s.status === 'pending').length,
    contacted: items.filter(s => s.status === 'contacted').length,
    booked:    items.filter(s => s.status === 'booked').length,
    dismissed: items.filter(s => s.status === 'dismissed').length,
  }

  // Sorteer wachtenden eerst op huidige zwangerschapsweek (hogere week = urgenter)
  const sorted = useMemo(() => {
    const today = new Date()
    return [...filtered].sort((a, b) => {
      const wa = weekFromDueDate(a.due_date, today) ?? -1
      const wb = weekFromDueDate(b.due_date, today) ?? -1
      if (wa !== wb) return wb - wa  // hoogste week eerst
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }, [filtered])

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Scanweek aanmeldingen</h1>
          <p className="text-gravida-sage mt-1 text-sm">
            Bezoekers die hun e-mail hebben achtergelaten om een reminder te krijgen rond de ideale scanweek (25-30 weken).
          </p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          {loading ? 'Vernieuwen...' : '↻ Vernieuwen'}
        </button>
      </div>

      {error && (
        <div className="card mb-6 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">
            <strong>Verbinding met site mislukt:</strong> {error}
          </p>
          <p className="text-xs text-red-600 mt-2">
            Check of <code>GRAVIDA_SITE_SECRET</code> in Vercel env vars staat en het scanweek-endpoint actief is op gravida-new.
          </p>
        </div>
      )}

      <div className="card mb-4 flex gap-1.5 flex-wrap">
        {[
          { key: 'pending',   label: `Wachtend (${counts.pending})` },
          { key: 'contacted', label: `Gecontacteerd (${counts.contacted})` },
          { key: 'booked',    label: `Geboekt (${counts.booked})` },
          { key: 'dismissed', label: `Afgesloten (${counts.dismissed})` },
          { key: 'all',       label: `Alles (${items.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key as typeof filter)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${filter === t.key ? 'bg-gravida-sage text-white' : 'bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-gravida-light-sage italic">Geen aanmeldingen in deze categorie.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(s => {
            const status = STATUS_LABELS[s.status]
            const week = weekFromDueDate(s.due_date)
            const isReady = week !== null && week >= 25 && week <= 30
            return (
              <div key={s.id} className={`card border-l-4 ${
                s.status === 'pending' ? (isReady ? 'border-red-500' : 'border-orange-400') :
                s.status === 'contacted' ? 'border-blue-400' :
                s.status === 'booked' ? 'border-green-400' : 'border-gray-300'
              }`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gravida-green truncate">{s.name || s.email}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.cls} whitespace-nowrap`}>
                        {status.label}
                      </span>
                      {isReady && s.status === 'pending' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                          🔔 Nu mailen
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gravida-sage mt-1 flex gap-3 flex-wrap">
                      <span>📧 {s.email}</span>
                      {s.phone && <span>📞 {s.phone}</span>}
                      {s.region && <span>📍 {s.region}</span>}
                    </div>
                    <div className="text-[11px] text-gravida-light-sage mt-1 flex gap-3 flex-wrap">
                      <span>Uitgerekend: {fmtDue(s.due_date)}</span>
                      {week !== null && <span>Nu {week} weken zwanger</span>}
                      <span>Aangemeld: {new Date(s.timestamp).toLocaleDateString('nl-NL')}</span>
                    </div>
                    {s.note && <p className="text-xs text-gravida-sage italic mt-1">{s.note}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    {s.status !== 'contacted' && (
                      <button onClick={() => updateStatus(s.id, 'contacted')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50">
                        ✉️ Gecontacteerd
                      </button>
                    )}
                    {s.status !== 'booked' && (
                      <button onClick={() => updateStatus(s.id, 'booked')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50">
                        ✓ Geboekt
                      </button>
                    )}
                    {s.status !== 'dismissed' && (
                      <button onClick={() => updateStatus(s.id, 'dismissed')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream text-gravida-sage hover:bg-gravida-off-white disabled:opacity-50">
                        Afsluiten
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
