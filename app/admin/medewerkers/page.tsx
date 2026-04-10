'use client'

import { useEffect, useState, useCallback } from 'react'

const ALL_REGIONS = [
  'Noord-Holland & Flevoland',
  'Utrecht & Gelderland & Overijssel',
  'Zuid-Holland',
  'Noord-Brabant',
  'Limburg',
  'Groningen, Friesland en Drenthe',
  'Showroom bezoek Haarlem',
  'Haarlem studioscan',
  'Curacao',
]

const DAYS = [
  { key: 'ma', label: 'Ma' },
  { key: 'di', label: 'Di' },
  { key: 'wo', label: 'Wo' },
  { key: 'do', label: 'Do' },
  { key: 'vr', label: 'Vr' },
  { key: 'za', label: 'Za' },
  { key: 'zo', label: 'Zo' },
]

type DayHours = { active: boolean; start: string; end: string }
type WorkingHours = { [day: string]: DayHours }

const defaultWorkingHours = (): WorkingHours => ({
  ma: { active: true,  start: '09:00', end: '17:00' },
  di: { active: true,  start: '09:00', end: '17:00' },
  wo: { active: true,  start: '09:00', end: '17:00' },
  do: { active: true,  start: '09:00', end: '17:00' },
  vr: { active: true,  start: '09:00', end: '17:00' },
  za: { active: false, start: '09:00', end: '17:00' },
  zo: { active: false, start: '09:00', end: '17:00' },
})

function parseWorkingHours(raw: WorkingHours | DayHours[] | null | undefined): WorkingHours {
  if (!raw || Array.isArray(raw)) return defaultWorkingHours()
  return { ...defaultWorkingHours(), ...raw }
}

function formatWorkingHoursSummary(wh: WorkingHours): string {
  const activeDays = DAYS.filter(d => wh[d.key]?.active)
  if (activeDays.length === 0) return 'Geen vaste werktijden'
  // Group consecutive days with same hours
  const groups: { days: string[]; start: string; end: string }[] = []
  for (const d of activeDays) {
    const h = wh[d.key]
    const last = groups[groups.length - 1]
    if (last && last.start === h.start && last.end === h.end) {
      last.days.push(d.label)
    } else {
      groups.push({ days: [d.label], start: h.start, end: h.end })
    }
  }
  return groups.map(g => {
    const dayStr = g.days.length === 1 ? g.days[0] : `${g.days[0]}–${g.days[g.days.length - 1]}`
    return `${dayStr} ${g.start}–${g.end}`
  }).join(', ')
}

interface StaffMember {
  id: number
  name: string
  email: string | null
  regions: string[]
  notes: string | null
  is_active: boolean
  working_hours: WorkingHours
  created_at: string
}

const emptyForm = () => ({
  name: '',
  email: '',
  regions: [] as string[],
  notes: '',
  working_hours: defaultWorkingHours(),
})

export default function MedewerkersPage() {
  const [staff, setStaff]         = useState<StaffMember[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm]           = useState(emptyForm())
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/staff')
      if (res.ok) {
        const data = await res.json()
        setStaff(data.staff ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  const openEdit = (s: StaffMember) => {
    setEditingId(s.id)
    setForm({
      name: s.name,
      email: s.email ?? '',
      regions: s.regions ?? [],
      notes: s.notes ?? '',
      working_hours: parseWorkingHours(s.working_hours),
    })
    setError('')
    setModalOpen(true)
  }

  const toggleRegion = (region: string) => {
    setForm(f => ({
      ...f,
      regions: f.regions.includes(region)
        ? f.regions.filter(r => r !== region)
        : [...f.regions, region],
    }))
  }

  const setDayHours = (day: string, field: keyof DayHours, value: string | boolean) => {
    setForm(f => ({
      ...f,
      working_hours: {
        ...f.working_hours,
        [day]: { ...f.working_hours[day], [field]: value },
      },
    }))
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError('Naam is verplicht'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name,
        email: form.email,
        regions: form.regions,
        notes: form.notes,
        working_hours: form.working_hours,
      }
      const res = editingId
        ? await fetch(`/api/admin/staff/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Opslaan mislukt'); return }
      setModalOpen(false)
      await loadStaff()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/staff/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    await loadStaff()
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Medewerkers</h1>
          <p className="text-gravida-sage mt-1">Beheer medewerkers, regio&apos;s en werktijden.</p>
        </div>
        <button onClick={openAdd} className="btn-primary shrink-0">+ Medewerker toevoegen</button>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center text-gravida-light-sage">Laden...</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {staff.map((s) => {
            const wh = parseWorkingHours(s.working_hours)
            return (
              <div key={s.id} className="card flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gravida-sage/20 flex items-center justify-center text-gravida-green font-semibold text-lg shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gravida-green">{s.name}</p>
                      {s.email && <p className="text-sm text-gravida-sage">{s.email}</p>}
                      {s.notes && <p className="text-xs text-gravida-light-sage italic mt-0.5">{s.notes}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEdit(s)} className="btn-secondary text-xs px-3 py-1.5">Bewerken</button>
                    <button onClick={() => setDeleteConfirm(s.id)} className="btn-danger text-xs px-3 py-1.5">Verwijderen</button>
                  </div>
                </div>

                {/* Regions */}
                <div>
                  <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Regio&apos;s</p>
                  {s.regions.length === 0 ? (
                    <p className="text-xs text-gravida-light-sage italic">Geen regio&apos;s toegewezen</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {s.regions.map(r => (
                        <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-medium
                          ${r === 'Curacao' ? 'bg-blue-100 text-blue-700' : 'bg-gravida-sage/15 text-gravida-green'}`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Working hours summary */}
                <div>
                  <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Werktijden</p>
                  <div className="flex flex-wrap gap-1">
                    {DAYS.map(d => {
                      const h = wh[d.key]
                      return h?.active ? (
                        <span key={d.key} className="inline-flex flex-col items-center bg-gravida-sage/10 rounded-lg px-2 py-1 min-w-[44px]">
                          <span className="text-[10px] font-semibold text-gravida-green">{d.label}</span>
                          <span className="text-[10px] text-gravida-sage leading-tight">{h.start}</span>
                          <span className="text-[10px] text-gravida-sage leading-tight">{h.end}</span>
                        </span>
                      ) : (
                        <span key={d.key} className="inline-flex flex-col items-center bg-gravida-cream/60 rounded-lg px-2 py-1 min-w-[44px] opacity-40">
                          <span className="text-[10px] font-semibold text-gravida-light-sage">{d.label}</span>
                          <span className="text-[10px] text-gravida-light-sage leading-tight">–</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {staff.length === 0 && (
            <div className="col-span-2 card text-center py-12 text-gravida-light-sage">
              Nog geen medewerkers toegevoegd.
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream">
              <h3 className="section-title">{editingId ? 'Medewerker bewerken' : 'Medewerker toevoegen'}</h3>
            </div>
            <div className="p-6 space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

              <div>
                <label className="label">Naam *</label>
                <input type="text" className="input-field" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="bijv. Laila"/>
              </div>

              <div>
                <label className="label">E-mailadres</label>
                <input type="email" className="input-field" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="medewerker@gravida.nl"/>
              </div>

              <div>
                <label className="label">Regio&apos;s</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_REGIONS.map(region => (
                    <button key={region} type="button" onClick={() => toggleRegion(region)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-colors
                        ${form.regions.includes(region)
                          ? region === 'Curacao'
                            ? 'border-blue-400 bg-blue-100 text-blue-700'
                            : 'border-gravida-sage bg-gravida-sage/15 text-gravida-green'
                          : 'border-gravida-cream text-gravida-light-sage hover:border-gravida-sage/40'}`}>
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              {/* Working hours */}
              <div>
                <label className="label">Werktijden</label>
                <div className="space-y-2">
                  {DAYS.map(d => {
                    const h = form.working_hours[d.key]
                    return (
                      <div key={d.key} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${h.active ? 'bg-gravida-sage/8' : 'bg-gravida-cream/40'}`}>
                        {/* Day toggle */}
                        <button
                          type="button"
                          onClick={() => setDayHours(d.key, 'active', !h.active)}
                          className={`w-10 h-6 rounded-full transition-colors shrink-0 relative ${h.active ? 'bg-gravida-green' : 'bg-gravida-cream'}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${h.active ? 'left-4' : 'left-0.5'}`}/>
                        </button>
                        <span className={`text-sm font-medium w-6 shrink-0 ${h.active ? 'text-gravida-green' : 'text-gravida-light-sage'}`}>
                          {d.label}
                        </span>
                        {h.active ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="time"
                              value={h.start}
                              onChange={e => setDayHours(d.key, 'start', e.target.value)}
                              className="input-field py-1 px-2 text-sm w-28"
                            />
                            <span className="text-gravida-light-sage text-sm">–</span>
                            <input
                              type="time"
                              value={h.end}
                              onChange={e => setDayHours(d.key, 'end', e.target.value)}
                              className="input-field py-1 px-2 text-sm w-28"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-gravida-light-sage italic flex-1">Niet werkzaam</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="label">Notitie (optioneel)</label>
                <input type="text" className="input-field" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="bijv. Locatie Curacao"/>
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
            <h3 className="section-title mb-2">Medewerker verwijderen?</h3>
            <p className="text-gravida-sage text-sm mb-6">Weet je zeker dat je deze medewerker wilt verwijderen?</p>
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
