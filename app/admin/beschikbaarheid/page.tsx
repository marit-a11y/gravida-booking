'use client'

import { useEffect, useState, useCallback } from 'react'
import { getDaysInMonth, getFirstDayOfWeek, generateTimeSlots, formatDutchDate, toLocalDateString } from '@/lib/utils'

interface Availability {
  id: number
  date: string
  region: string
  slots: string[]
  max_per_slot: number
  notes: string | null
  is_active: boolean
}

const DUTCH_MONTHS = [
  'Januari','Februari','Maart','April','Mei','Juni',
  'Juli','Augustus','September','Oktober','November','December',
]
const DUTCH_DAYS_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']
const SLOT_DURATIONS = [15, 30, 45, 60, 90]

interface FormState {
  region: string
  start_time: string
  end_time: string
  duration: number
  max_per_slot: number
  notes: string
}

const emptyForm: FormState = {
  region: '',
  start_time: '09:00',
  end_time: '17:00',
  duration: 45,
  max_per_slot: 2,
  notes: '',
}

export default function BeschikbaarheidPage() {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const loadAvailability = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/availability')
      if (res.ok) {
        const data = await res.json()
        setAvailability(data.availability ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  const availMap = new Map(availability.map((a) => [a.date, a]))

  const days = getDaysInMonth(calYear, calMonth)
  const firstDow = getFirstDayOfWeek(calYear, calMonth)
  const todayStr = toLocalDateString(today)

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
    else setCalMonth(m => m + 1)
  }

  const openAddModal = (dateStr: string) => {
    setSelectedDate(dateStr)
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (avail: Availability) => {
    setSelectedDate(avail.date)
    setEditingId(avail.id)
    // Try to reverse-engineer start/end from slots
    const slots = avail.slots
    setForm({
      region: avail.region,
      start_time: slots.length > 0 ? slots[0] : '09:00',
      end_time: '17:00',
      duration: 45,
      max_per_slot: avail.max_per_slot,
      notes: avail.notes ?? '',
    })
    setError('')
    setModalOpen(true)
  }

  const previewSlots = generateTimeSlots(form.start_time, form.end_time, form.duration)

  const handleSave = async () => {
    setError('')
    if (!form.region.trim()) { setError('Regio is verplicht'); return }
    if (previewSlots.length === 0) { setError('Geen tijdslots gegenereerd. Controleer start- en eindtijd.'); return }

    setSaving(true)
    try {
      const body = {
        date: selectedDate,
        region: form.region.trim(),
        slots: previewSlots,
        max_per_slot: form.max_per_slot,
        notes: form.notes.trim() || undefined,
      }

      const res = editingId
        ? await fetch(`/api/admin/availability/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/admin/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Opslaan mislukt')
        return
      }

      setModalOpen(false)
      await loadAvailability()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/admin/availability/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleteConfirm(null)
      await loadAvailability()
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Beschikbaarheid</h1>
        <p className="text-gravida-sage mt-1">Klik op een dag om beschikbaarheid toe te voegen of te bewerken.</p>
      </div>

      <div className="card">
        {/* Calendar header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-lg">
            ‹
          </button>
          <h2 className="section-title">{DUTCH_MONTHS[calMonth]} {calYear}</h2>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-lg">
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DUTCH_DAYS_SHORT.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gravida-light-sage py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gravida-light-sage">Laden...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
            {days.map((dateStr) => {
              const dayNum = parseInt(dateStr.split('-')[2], 10)
              const avail = availMap.get(dateStr)
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr

              return (
                <button
                  key={dateStr}
                  onClick={() => avail ? openEditModal(avail) : openAddModal(dateStr)}
                  className={`
                    relative min-h-[72px] rounded-xl p-2 text-left transition-all duration-150 border-2
                    ${isToday ? 'border-gravida-sage' : 'border-transparent'}
                    ${avail && avail.is_active
                      ? 'bg-gravida-sage/10 hover:bg-gravida-sage/20'
                      : isPast
                      ? 'opacity-40 cursor-default hover:bg-transparent'
                      : 'hover:bg-gravida-cream cursor-pointer'
                    }
                  `}
                >
                  <span className={`text-sm font-semibold ${
                    isToday ? 'text-gravida-sage' : 'text-gravida-green'
                  }`}>
                    {dayNum}
                  </span>
                  {avail && avail.is_active && (
                    <div className="mt-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-gravida-sage mb-1" />
                      <p className="text-xs text-gravida-sage leading-tight truncate font-medium">
                        {avail.region}
                      </p>
                      <p className="text-xs text-gravida-light-sage">
                        {avail.slots.length} slots
                      </p>
                    </div>
                  )}
                  {!avail && !isPast && (
                    <p className="text-xs text-gravida-cream mt-1">+ toevoegen</p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming availability list */}
      <div className="card mt-6">
        <h2 className="section-title mb-4">Komende beschikbaarheid</h2>
        {availability.filter(a => a.date >= todayStr && a.is_active).length === 0 ? (
          <p className="text-gravida-light-sage text-sm">Geen beschikbaarheid ingesteld.</p>
        ) : (
          <div className="space-y-2">
            {availability
              .filter(a => a.date >= todayStr && a.is_active)
              .slice(0, 10)
              .map((avail) => (
                <div key={avail.id} className="flex items-center justify-between py-3 border-b border-gravida-cream last:border-0">
                  <div>
                    <p className="font-medium text-sm">{formatDutchDate(avail.date)}</p>
                    <p className="text-sm text-gravida-sage">{avail.region} · {avail.slots.length} tijdslots · max {avail.max_per_slot} per slot</p>
                    {avail.notes && <p className="text-xs text-gravida-light-sage italic">{avail.notes}</p>}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openEditModal(avail)}
                      className="btn-secondary text-sm px-3 py-1.5"
                    >
                      Bewerken
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(avail.id)}
                      className="btn-danger text-sm px-3 py-1.5"
                    >
                      Verwijderen
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream">
              <h3 className="section-title">
                {editingId ? 'Beschikbaarheid bewerken' : 'Beschikbaarheid toevoegen'}
              </h3>
              {selectedDate && (
                <p className="text-gravida-sage text-sm mt-1">{formatDutchDate(selectedDate)}</p>
              )}
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="label">Regio *</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="bijv. Amsterdam Noord, Utrecht Centrum"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Begintijd *</label>
                  <input
                    type="time"
                    className="input-field"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Eindtijd *</label>
                  <input
                    type="time"
                    className="input-field"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Duur per slot (minuten)</label>
                  <select
                    className="input-field"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })}
                  >
                    {SLOT_DURATIONS.map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Max. afspraken per slot</label>
                  <input
                    type="number"
                    className="input-field"
                    value={form.max_per_slot}
                    min={1}
                    max={10}
                    onChange={(e) => setForm({ ...form, max_per_slot: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Opmerkingen (optioneel)</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="bijv. parkeren mogelijk op de oprit"
                />
              </div>

              {/* Preview slots */}
              <div>
                <label className="label">Gegenereerde tijdslots ({previewSlots.length})</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gravida-off-white rounded-xl border border-gravida-cream">
                  {previewSlots.length === 0 ? (
                    <span className="text-gravida-light-sage text-sm">Geen tijdslots — controleer begintijd/eindtijd</span>
                  ) : previewSlots.map((s) => (
                    <span key={s} className="px-2.5 py-1 bg-gravida-sage/20 text-gravida-green rounded-lg text-xs font-medium">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gravida-cream flex gap-3 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="btn-secondary"
                disabled={saving}
              >
                Annuleren
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Opslaan...
                  </span>
                ) : (
                  editingId ? 'Bijwerken' : 'Toevoegen'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h3 className="section-title mb-2">Beschikbaarheid verwijderen?</h3>
            <p className="text-gravida-sage text-sm mb-6">
              Dit verwijdert de beschikbaarheid definitief. Bestaande boekingen blijven behouden.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">
                Annuleren
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger px-6 py-3">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
