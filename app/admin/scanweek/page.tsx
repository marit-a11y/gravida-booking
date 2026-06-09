'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { currentPregnancyWeek, estimatedDueDate, reminderDate, REMINDER_WEEK } from '@/lib/scanweek'

interface Signup {
  id: number
  email: string
  name: string | null
  current_week: number | null
  signup_week_date: string
  region: string | null
  status: 'pending' | 'contacted' | 'booked' | 'dismissed'
  note: string | null
  confirm_sent_at: string | null
  reminder_sent_at: string | null
  created_at: string
}

const STATUS_LABELS: Record<Signup['status'], { label: string; cls: string }> = {
  pending:   { label: 'Wachtend',      cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  contacted: { label: 'Reminder verstuurd', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  booked:    { label: 'Geboekt',       cls: 'bg-green-100 text-green-700 border-green-200' },
  dismissed: { label: 'Afgesloten',    cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

function fmt(d: string | null): string {
  if (!d) return '—'
  const dd = new Date(d.length <= 10 ? d + 'T00:00:00' : d)
  if (isNaN(dd.getTime())) return d
  return dd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ScanweekPage() {
  const [items, setItems] = useState<Signup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | Signup['status']>('pending')
  const [updating, setUpdating] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/admin/scanweek', { credentials: 'include', cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) { setError(d?.error ?? 'Laden mislukt'); setItems([]) }
      else setItems(d.signups ?? [])
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const updateStatus = async (id: number, status: Signup['status']) => {
    setUpdating(id)
    try {
      const r = await fetch('/api/admin/scanweek', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (r.ok) setItems(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      else { const d = await r.json().catch(() => ({})); alert('Fout: ' + (d?.error ?? 'mislukt')) }
    } finally { setUpdating(null) }
  }

  const counts = {
    pending:   items.filter(s => s.status === 'pending').length,
    contacted: items.filter(s => s.status === 'contacted').length,
    booked:    items.filter(s => s.status === 'booked').length,
    dismissed: items.filter(s => s.status === 'dismissed').length,
  }
  const filtered = filter === 'all' ? items : items.filter(s => s.status === filter)

  // Sorteer wachtenden: wie het dichtst bij (of voorbij) reminderweek zit eerst
  const sorted = useMemo(() => {
    const now = new Date()
    return [...filtered].sort((a, b) => {
      const wa = a.current_week != null ? currentPregnancyWeek(a.current_week, a.signup_week_date, now) : -1
      const wb = b.current_week != null ? currentPregnancyWeek(b.current_week, b.signup_week_date, now) : -1
      return wb - wa
    })
  }, [filtered])

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Scanweek aanmeldingen</h1>
          <p className="text-gravida-sage mt-1 text-sm">
            Bezoekers die een herinnering willen rond de ideale scanweek (34-36). De reminder gaat automatisch rond week {REMINDER_WEEK}.
          </p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">{loading ? 'Vernieuwen...' : '↻ Vernieuwen'}</button>
      </div>

      {error && (
        <div className="card mb-6 bg-red-50 border-red-200">
          <p className="text-sm text-red-700"><strong>Laden mislukt:</strong> {error}</p>
        </div>
      )}

      <div className="card mb-4 flex gap-1.5 flex-wrap">
        {[
          { key: 'pending', label: `Wachtend (${counts.pending})` },
          { key: 'contacted', label: `Reminder verstuurd (${counts.contacted})` },
          { key: 'booked', label: `Geboekt (${counts.booked})` },
          { key: 'dismissed', label: `Afgesloten (${counts.dismissed})` },
          { key: 'all', label: `Alles (${items.length})` },
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
            const nowWeek = s.current_week != null ? currentPregnancyWeek(s.current_week, s.signup_week_date) : null
            const due = s.current_week != null ? estimatedDueDate(s.current_week, s.signup_week_date) : null
            const remind = s.current_week != null ? reminderDate(s.current_week, s.signup_week_date) : null
            const ready = nowWeek != null && nowWeek >= REMINDER_WEEK && nowWeek <= 38
            return (
              <div key={s.id} className={`card border-l-4 ${
                s.status === 'pending' ? (ready ? 'border-red-500' : 'border-orange-400') :
                s.status === 'contacted' ? 'border-blue-400' :
                s.status === 'booked' ? 'border-green-400' : 'border-gray-300'
              }`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gravida-green truncate">{s.name || s.email}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.cls} whitespace-nowrap`}>{status.label}</span>
                      {ready && s.status === 'pending' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">🔔 Reminder-week bereikt</span>
                      )}
                    </div>
                    <div className="text-xs text-gravida-sage mt-1 flex gap-3 flex-wrap">
                      <span>📧 {s.email}</span>
                      {s.region && <span>📍 {s.region}</span>}
                    </div>
                    <div className="text-[11px] text-gravida-light-sage mt-1 flex gap-3 flex-wrap">
                      {s.current_week != null
                        ? <><span>Bij aanmelding: week {s.current_week}</span><span className="font-medium text-gravida-sage">Nu: ± week {nowWeek}</span></>
                        : <span className="text-amber-600">⚠ geen week opgegeven</span>}
                      {due && <span>Uitgerekend ± {fmt(due)}</span>}
                      {remind && <span>Reminder ± {fmt(remind)}</span>}
                      <span>Aangemeld {fmt(s.created_at.slice(0,10))}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-wrap shrink-0">
                    {s.status !== 'contacted' && (
                      <button onClick={() => updateStatus(s.id, 'contacted')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50">✉️ Gecontacteerd</button>
                    )}
                    {s.status !== 'booked' && (
                      <button onClick={() => updateStatus(s.id, 'booked')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50">✓ Geboekt</button>
                    )}
                    {s.status !== 'dismissed' && (
                      <button onClick={() => updateStatus(s.id, 'dismissed')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream text-gravida-sage hover:bg-gravida-off-white disabled:opacity-50">Afsluiten</button>
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
