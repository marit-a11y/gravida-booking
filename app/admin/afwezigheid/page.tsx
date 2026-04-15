'use client'

import { useEffect, useState, useCallback } from 'react'
import { getDaysInMonth, getFirstDayOfWeek, formatDutchDate, toLocalDateString } from '@/lib/utils'

const DUTCH_MONTHS     = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const DUTCH_DAYS_SHORT = ['Ma','Di','Wo','Do','Vr','Za','Zo']

const REASONS = ['Vakantie', 'Vrije dag', 'Ziek', 'Cursus / training', 'Anders']

// Tailwind colours per staff member (cycled by index)
const STAFF_COLORS = [
  { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-400',   border: 'border-amber-300',   calBg: 'bg-amber-50',   calDot: 'bg-amber-400' },
  { bg: 'bg-blue-100',    text: 'text-blue-800',     dot: 'bg-blue-400',    border: 'border-blue-300',    calBg: 'bg-blue-50',    calDot: 'bg-blue-400'  },
  { bg: 'bg-purple-100',  text: 'text-purple-800',   dot: 'bg-purple-400',  border: 'border-purple-300',  calBg: 'bg-purple-50',  calDot: 'bg-purple-400'},
  { bg: 'bg-green-100',   text: 'text-green-800',    dot: 'bg-green-400',   border: 'border-green-300',   calBg: 'bg-green-50',   calDot: 'bg-green-400' },
  { bg: 'bg-rose-100',    text: 'text-rose-800',     dot: 'bg-rose-400',    border: 'border-rose-300',    calBg: 'bg-rose-50',    calDot: 'bg-rose-400'  },
]

interface StaffMember { id: number; name: string }
interface AbsenceEntry {
  id: number
  staff_id: number
  staff_name: string
  date_from: string
  date_to: string
  reason: string
  notes: string | null
}

const emptyForm = (dateStr: string) => ({
  staff_id: '' as string | number,
  date_from: dateStr,
  date_to: dateStr,
  reason: 'Vrije dag',
  notes: '',
})

// Expand a date range to individual YYYY-MM-DD strings
function expandRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur  = new Date(from + 'T12:00:00')
  const end  = new Date(to   + 'T12:00:00')
  while (cur <= end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1) }
  return dates
}

function formatDateRange(from: string, to: string): string {
  if (from === to) return formatDutchDate(from)
  return `${formatDutchDate(from)} t/m ${formatDutchDate(to)}`
}

export default function AfwezigheidPage() {
  const today    = new Date()
  const todayStr = toLocalDateString(today)

  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [absence, setAbsence]   = useState<AbsenceEntry[]>([])
  const [staff, setStaff]       = useState<StaffMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [filterStaff, setFilterStaff] = useState<number | null>(null)   // null = all

  // Modal
  const [modalOpen, setModalOpen]   = useState(false)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [form, setForm]             = useState(emptyForm(todayStr))
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [absRes, staffRes] = await Promise.all([
        fetch('/api/admin/absence'),
        fetch('/api/admin/staff'),
      ])
      if (absRes.ok)   { const d = await absRes.json();   setAbsence(d.absence ?? []) }
      if (staffRes.ok) { const d = await staffRes.json(); setStaff(d.staff ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Map staff index → colour set
  const staffColorMap = new Map<number, typeof STAFF_COLORS[0]>()
  staff.forEach((s, i) => staffColorMap.set(s.id, STAFF_COLORS[i % STAFF_COLORS.length]))

  // Build date→entries map for calendar
  const dateMap = new Map<string, AbsenceEntry[]>()
  for (const a of absence) {
    if (filterStaff !== null && a.staff_id !== filterStaff) continue
    for (const d of expandRange(a.date_from, a.date_to)) {
      const arr = dateMap.get(d) ?? []
      arr.push(a)
      dateMap.set(d, arr)
    }
  }

  const days     = getDaysInMonth(calYear, calMonth)
  const firstDow = getFirstDayOfWeek(calYear, calMonth)

  const prevMonth = () => { if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }

  const openAdd = (dateStr: string) => {
    setEditingId(null)
    setForm({
      ...emptyForm(dateStr),
      staff_id: filterStaff ?? (staff[0]?.id ?? ''),
    })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (entry: AbsenceEntry) => {
    setEditingId(entry.id)
    setForm({
      staff_id: entry.staff_id,
      date_from: entry.date_from,
      date_to: entry.date_to,
      reason: entry.reason,
      notes: entry.notes ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    setError('')
    if (!form.staff_id) { setError('Selecteer een medewerker'); return }
    if (!form.date_from || !form.date_to) { setError('Datums zijn verplicht'); return }
    if (form.date_to < form.date_from) { setError('Einddatum moet na startdatum zijn'); return }
    setSaving(true)
    try {
      const body = { staff_id: Number(form.staff_id), date_from: form.date_from, date_to: form.date_to, reason: form.reason, notes: form.notes }
      const res = editingId
        ? await fetch(`/api/admin/absence/${editingId}`, { method: 'PUT',    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/admin/absence',               { method: 'POST',   headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Opslaan mislukt'); return }
      setModalOpen(false)
      await loadData()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/absence/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    await loadData()
  }

  // Upcoming absences (from today onwards)
  const upcoming = absence
    .filter(a => a.date_to >= todayStr && (filterStaff === null || a.staff_id === filterStaff))
    .sort((a, b) => a.date_from.localeCompare(b.date_from))

  const dayCount = (from: string, to: string) => {
    const d = Math.round((new Date(to+'T12:00:00').getTime() - new Date(from+'T12:00:00').getTime()) / 86400000) + 1
    return d === 1 ? '1 dag' : `${d} dagen`
  }

  return (
    <div>
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Afwezigheid</h1>
          <p className="text-gravida-sage mt-1">Vakanties en vrije dagen per medewerker.</p>
        </div>
        <button onClick={() => openAdd(todayStr)} className="btn-primary shrink-0">+ Afwezigheid toevoegen</button>
      </div>

      {/* Staff filter tabs */}
      {staff.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setFilterStaff(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors
              ${filterStaff === null ? 'border-gravida-sage bg-gravida-sage/10 text-gravida-green' : 'border-gravida-cream text-gravida-light-sage hover:border-gravida-sage/40'}`}>
            Alle medewerkers
          </button>
          {staff.map((s, i) => {
            const c = STAFF_COLORS[i % STAFF_COLORS.length]
            const active = filterStaff === s.id
            return (
              <button key={s.id} onClick={() => setFilterStaff(active ? null : s.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-colors flex items-center gap-2
                  ${active ? `${c.border} ${c.bg} ${c.text}` : 'border-gravida-cream text-gravida-light-sage hover:border-gravida-sage/40'}`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`}/>
                {s.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Calendar */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">‹</button>
          <h2 className="section-title">{DUTCH_MONTHS[calMonth]} {calYear}</h2>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">›</button>
        </div>
        <div className="min-w-[480px]">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DUTCH_DAYS_SHORT.map(d => <div key={d} className="text-center text-xs font-medium text-gravida-light-sage py-1">{d}</div>)}
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gravida-light-sage">Laden...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_,i) => <div key={`e-${i}`}/>)}
            {days.map(dateStr => {
              const dayNum   = parseInt(dateStr.split('-')[2], 10)
              const entries  = dateMap.get(dateStr) ?? []
              const isToday  = dateStr === todayStr
              const isPast   = dateStr < todayStr
              const hasAbs   = entries.length > 0
              return (
                <div key={dateStr}
                  className={`relative min-h-[48px] sm:min-h-[64px] rounded-xl p-1.5 sm:p-2 text-left border-2 transition-all
                    ${isToday ? 'border-gravida-sage' : 'border-transparent'}
                    ${hasAbs ? 'bg-amber-50' : isPast ? 'opacity-40' : ''}`}>
                  <span className={`text-sm font-semibold ${isToday ? 'text-gravida-sage' : 'text-gravida-green'}`}>{dayNum}</span>

                  {/* Absence entries */}
                  {entries.map(a => {
                    const c = staffColorMap.get(a.staff_id) ?? STAFF_COLORS[0]
                    return (
                      <button key={a.id} onClick={() => openEdit(a)}
                        className={`w-full text-left mt-0.5 rounded px-1 py-0.5 text-xs font-medium truncate transition-colors hover:opacity-80 ${c.bg} ${c.text}`}>
                        {a.staff_name.split(' ')[0]}
                      </button>
                    )
                  })}

                  {/* Add link */}
                  {!isPast && (
                    <button onClick={() => openAdd(dateStr)}
                      className={`text-xs mt-0.5 w-full text-left transition-colors hover:text-gravida-sage
                        ${hasAbs ? 'text-amber-300' : 'text-gravida-cream'}`}>
                      +
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="card mt-6">
        <h2 className="section-title mb-4">Komende afwezigheid</h2>
        {upcoming.length === 0 ? (
          <p className="text-gravida-light-sage text-sm">Geen afwezigheid ingepland.</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(a => {
              const idx = staff.findIndex(s => s.id === a.staff_id)
              const c = STAFF_COLORS[idx >= 0 ? idx % STAFF_COLORS.length : 0]
              return (
                <div key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gravida-cream last:border-0 gap-2 sm:gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${c.dot}`}/>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gravida-green">{a.staff_name}</p>
                      <p className="text-sm text-gravida-sage">{formatDateRange(a.date_from, a.date_to)} · {dayCount(a.date_from, a.date_to)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>{a.reason}</span>
                        {a.notes && <span className="text-xs text-gravida-light-sage italic truncate">{a.notes}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-5 sm:ml-0">
                    <button onClick={() => openEdit(a)} className="btn-secondary text-xs px-3 py-1.5">Bewerken</button>
                    <button onClick={() => setDeleteConfirm(a.id)} className="btn-danger text-xs px-3 py-1.5">Verwijderen</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Add/Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-gravida-cream">
              <h3 className="section-title">{editingId ? 'Afwezigheid bewerken' : 'Afwezigheid toevoegen'}</h3>
            </div>
            <div className="p-6 space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

              {/* Staff */}
              <div>
                <label className="label">Medewerker *</label>
                <select className="input-field" value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
                  <option value="">— selecteer medewerker —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Van *</label>
                  <input type="date" className="input-field" value={form.date_from}
                    onChange={e => setForm(f => ({ ...f, date_from: e.target.value, date_to: e.target.value > f.date_to ? e.target.value : f.date_to }))}/>
                </div>
                <div>
                  <label className="label">Tot en met *</label>
                  <input type="date" className="input-field" value={form.date_to}
                    min={form.date_from}
                    onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))}/>
                </div>
              </div>
              {form.date_from && form.date_to && (
                <p className="text-xs text-gravida-sage -mt-3">{dayCount(form.date_from, form.date_to)}</p>
              )}

              {/* Reason */}
              <div>
                <label className="label">Reden</label>
                <div className="flex flex-wrap gap-2">
                  {REASONS.map(r => (
                    <button key={r} type="button" onClick={() => setForm(f => ({ ...f, reason: r }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-colors
                        ${form.reason === r
                          ? 'border-amber-400 bg-amber-100 text-amber-800'
                          : 'border-gravida-cream text-gravida-light-sage hover:border-amber-200'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notitie (optioneel)</label>
                <input type="text" className="input-field" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="bijv. Spanje, 2 weken"/>
              </div>
            </div>
            <div className="p-6 border-t border-gravida-cream flex gap-3 justify-end">
              <button onClick={() => setModalOpen(false)} className="btn-secondary" disabled={saving}>Annuleren</button>
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving
                  ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Opslaan...</span>
                  : editingId ? 'Bijwerken' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h3 className="section-title mb-2">Afwezigheid verwijderen?</h3>
            <p className="text-gravida-sage text-sm mb-6">Weet je zeker dat je deze afwezigheidsperiode wilt verwijderen?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">Annuleren</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger px-6 py-3">Verwijderen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
