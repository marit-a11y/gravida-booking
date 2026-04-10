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
  booked_slots: string[]
}

interface StaffMember {
  id: number
  name: string
  regions: string[]
  working_hours: Record<string, { active: boolean; start: string; end: string }>
}

const DAY_KEYS = ['ma','di','wo','do','vr','za','zo']

const DUTCH_MONTHS    = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const DUTCH_DAYS_SHORT = ['Ma','Di','Wo','Do','Vr','Za','Zo']
const DUTCH_DAYS_FULL  = ['maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag','zondag']
const ORDINALS         = ['eerste','tweede','derde','vierde','vijfde']

const REGIONS = [
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

// Slot spacing: 60 min appointment + 30 min travel buffer = 90 min between slots
const SLOT_SPACING = 90

type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly'

interface ConflictItem { date: string; region: string; overlapping: string[] }
interface PendingSave { dates: string[]; slots: string[]; region: string; notes: string; editingId: number | null; selectedDate: string | null }

interface FormState {
  region: string
  start_time: string
  end_time: string
  notes: string
  recurrence: RecurrenceType
  until_date: string
}

const emptyForm = (todayStr: string): FormState => ({
  region: REGIONS[0],
  start_time: '09:00',
  end_time: '17:00',
  notes: '',
  recurrence: 'none',
  until_date: todayStr,
})

// Compute which nth weekday of the month a date is (1-indexed)
function getNthWeekdayOfMonth(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  return Math.ceil(d.getDate() / 7)
}

// Get weekday (0=Mon … 6=Sun)
function getDowMon(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00')
  return (d.getDay() + 6) % 7
}

// Expand a date + recurrence into an array of YYYY-MM-DD strings
function expandRecurrence(startDate: string, recurrence: RecurrenceType, untilDate: string): string[] {
  if (recurrence === 'none') return [startDate]
  const dates: string[] = []
  const until = new Date(untilDate + 'T12:00:00')
  const nth   = getNthWeekdayOfMonth(startDate)
  const dow   = new Date(startDate + 'T12:00:00').getDay() // Sun=0

  let cur = new Date(startDate + 'T12:00:00')
  while (cur <= until) {
    dates.push(cur.toISOString().split('T')[0])
    if (recurrence === 'weekly')   { cur.setDate(cur.getDate() + 7) }
    else if (recurrence === 'biweekly') { cur.setDate(cur.getDate() + 14) }
    else if (recurrence === 'monthly') {
      // Move to same nth weekday next month
      cur.setMonth(cur.getMonth() + 1)
      cur.setDate(1)
      while (cur.getDay() !== dow) cur.setDate(cur.getDate() + 1)
      cur.setDate(cur.getDate() + (nth - 1) * 7)
    }
  }
  return dates
}

// Build human-readable recurrence label for a given dateStr
function recurrenceLabel(type: RecurrenceType, dateStr: string): string {
  if (!dateStr || type === 'none') return ''
  const dow = getDowMon(dateStr)
  const dayName = DUTCH_DAYS_FULL[dow]
  const nth = getNthWeekdayOfMonth(dateStr)
  if (type === 'weekly')   return `Wekelijks op ${dayName}`
  if (type === 'biweekly') return `Elke 2 weken op ${dayName}`
  if (type === 'monthly')  return `Maandelijks op de ${ORDINALS[nth - 1]} ${dayName}`
  return ''
}

// Default until date: today + 3 months
function defaultUntil(startDate: string, recurrence: RecurrenceType): string {
  const d = new Date(startDate + 'T12:00:00')
  if (recurrence === 'monthly') d.setMonth(d.getMonth() + 6)
  else d.setMonth(d.getMonth() + 3)
  return d.toISOString().split('T')[0]
}

// ─── Bulk helpers ─────────────────────────────────────────────────────────────
function getDatesInRange(startDate: string, endDate: string, weekdays: Set<number>): string[] {
  const dates: string[] = []
  const cur = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  while (cur <= end) {
    const dow = (cur.getDay() + 6) % 7
    if (weekdays.has(dow)) dates.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// Return the date of targetDow (0=Mon…6=Sun) in the same ISO week as dateStr
function getWeekdayInSameWeek(dateStr: string, targetDow: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  const curDow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - curDow + targetDow)
  return d.toISOString().split('T')[0]
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BeschikbaarheidPage() {
  const today    = new Date()
  const todayStr = toLocalDateString(today)

  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading]   = useState(true)
  const [staff, setStaff]       = useState<StaffMember[]>([])

  // Single-day modal
  const [modalOpen, setModalOpen]       = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editingId, setEditingId]       = useState<number | null>(null)
  const [form, setForm]                 = useState<FormState>(emptyForm(todayStr))
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(new Set())

  // Bulk modal
  const [bulkOpen, setBulkOpen]           = useState(false)
  const [bulkMode, setBulkMode]           = useState<'week' | 'month'>('week')
  const [bulkForm, setBulkForm]           = useState<Omit<FormState,'recurrence'|'until_date'>>(
    { region: REGIONS[0], start_time: '09:00', end_time: '17:00', notes: '' }
  )
  const [bulkWeekdays, setBulkWeekdays]   = useState<Set<number>>(new Set([0,1,2,3,4]))
  const [bulkStartDate, setBulkStartDate] = useState(todayStr)
  const [bulkEndDate, setBulkEndDate]     = useState(todayStr)
  const [bulkMonth, setBulkMonth]         = useState(today.getMonth())
  const [bulkYear, setBulkYear]           = useState(today.getFullYear())
  const [bulkSaving, setBulkSaving]       = useState(false)
  const [bulkError, setBulkError]         = useState('')
  const [bulkResult, setBulkResult]       = useState<string | null>(null)

  // Conflict warning
  const [conflictInfo, setConflictInfo]   = useState<ConflictItem[] | null>(null)
  const [pendingSave, setPendingSave]     = useState<PendingSave | null>(null)
  const [conflictIsBulk, setConflictIsBulk] = useState(false)

  const loadAvailability = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/availability')
      if (res.ok) { const data = await res.json(); setAvailability(data.availability ?? []) }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAvailability() }, [loadAvailability])

  // Load staff once for working-hours lookup
  useEffect(() => {
    fetch('/api/admin/staff')
      .then(r => r.ok ? r.json() : { staff: [] })
      .then(d => setStaff(d.staff ?? []))
      .catch(() => {})
  }, [])

  // Return the working hours {start, end} for a given region + weekday (0=Mon…6=Sun)
  // Finds the first active staff member covering the region with that day enabled
  const getStaffTimes = (region: string, dow: number): { start: string; end: string } | null => {
    const key = DAY_KEYS[dow]
    for (const s of staff) {
      if (!s.regions?.includes(region)) continue
      const h = s.working_hours?.[key]
      if (h?.active) return { start: h.start, end: h.end }
    }
    return null
  }

  // availMap: first entry per date (for calendar display)
  const availMap = new Map(availability.map((a) => [a.date, a]))

  // availByDate: all entries per date (for conflict detection)
  const availByDate = new Map<string, Availability[]>()
  for (const a of availability) {
    const arr = availByDate.get(a.date) ?? []
    arr.push(a)
    availByDate.set(a.date, arr)
  }

  // Check if new slots (for a given region) overlap with existing entries of a different region
  const checkConflicts = (dates: string[], newSlots: string[], newRegion: string, excludeId: number | null = null): ConflictItem[] => {
    const conflicts: ConflictItem[] = []
    for (const date of dates) {
      const existing = availByDate.get(date) ?? []
      for (const entry of existing) {
        if (entry.id === excludeId) continue
        if (entry.region === newRegion) continue
        const overlapping: string[] = []
        for (const newSlot of newSlots) {
          const [nh, nm] = newSlot.split(':').map(Number)
          const newStart = nh * 60 + nm
          const newEnd   = newStart + 60
          for (const existSlot of entry.slots) {
            const [eh, em] = existSlot.split(':').map(Number)
            const existStart = eh * 60 + em
            const existEnd   = existStart + 60
            if (newStart < existEnd && existStart < newEnd) {
              if (!overlapping.includes(newSlot)) overlapping.push(newSlot)
              break
            }
          }
        }
        if (overlapping.length > 0) {
          conflicts.push({ date, region: entry.region, overlapping })
        }
      }
    }
    return conflicts
  }

  const days      = getDaysInMonth(calYear, calMonth)
  const firstDow  = getFirstDayOfWeek(calYear, calMonth)

  const prevMonth = () => { if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }

  const openAddModal = (dateStr: string) => {
    setSelectedDate(dateStr); setEditingId(null)
    const dow = getDowMon(dateStr)
    const base = { ...emptyForm(dateStr), until_date: defaultUntil(dateStr, 'none') }
    const staffTimes = getStaffTimes(base.region, dow)
    setForm(staffTimes ? { ...base, start_time: staffTimes.start, end_time: staffTimes.end } : base)
    setSelectedWeekdays(new Set([dow]))
    setError(''); setModalOpen(true)
  }
  const openEditModal = (avail: Availability) => {
    setSelectedDate(avail.date); setEditingId(avail.id)
    setForm({
      region: avail.region,
      start_time: avail.slots.length > 0 ? avail.slots[0] : '09:00',
      end_time: '17:00', notes: avail.notes ?? '',
      recurrence: 'none', until_date: defaultUntil(avail.date, 'none'),
    })
    setSelectedWeekdays(new Set([getDowMon(avail.date)]))
    setError(''); setModalOpen(true)
  }

  const previewSlots  = generateTimeSlots(form.start_time, form.end_time, SLOT_SPACING)
  const editingAvail  = editingId ? availability.find(a => a.id === editingId) ?? null : null

  // When recurrence changes, update until_date default
  const setRecurrence = (r: RecurrenceType) => {
    setForm(f => ({ ...f, recurrence: r, until_date: selectedDate ? defaultUntil(selectedDate, r) : f.until_date }))
  }

  // Actually perform the single-day save
  const doActualSave = async (save: PendingSave) => {
    setSaving(true)
    try {
      if (save.editingId && save.dates.length === 1) {
        const body = { date: save.selectedDate, region: save.region, slots: save.slots, max_per_slot: 1, notes: save.notes || undefined }
        const res = await fetch(`/api/admin/availability/${save.editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Opslaan mislukt'); return }
      } else {
        for (const date of save.dates) {
          // Skip only if same region already exists for this date
          if (availByDate.get(date)?.some(e => e.region === save.region)) continue
          await fetch('/api/admin/availability', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, region: save.region, slots: save.slots, max_per_slot: 1, notes: save.notes || undefined }),
          })
        }
      }
      setModalOpen(false)
      setConflictInfo(null)
      setPendingSave(null)
      await loadAvailability()
    } finally { setSaving(false) }
  }

  const handleSave = async () => {
    setError('')
    if (!form.region) { setError('Regio is verplicht'); return }
    if (previewSlots.length === 0) { setError('Geen tijdslots — controleer begin- en eindtijd'); return }
    if (allModalDates.length === 0) { setError('Geen datums geselecteerd'); return }

    // Check for conflicting slots on same day, different region
    const conflicts = checkConflicts(allModalDates, previewSlots, form.region, editingId)
    if (conflicts.length > 0) {
      setConflictInfo(conflicts)
      setPendingSave({ dates: allModalDates, slots: previewSlots, region: form.region, notes: form.notes.trim(), editingId, selectedDate })
      setConflictIsBulk(false)
      return
    }

    await doActualSave({ dates: allModalDates, slots: previewSlots, region: form.region, notes: form.notes.trim(), editingId, selectedDate })
  }

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/admin/availability/${id}`, { method: 'DELETE' })
    if (res.ok) { setDeleteConfirm(null); await loadAvailability() }
  }

  const toggleModalWeekday = (dow: number) => {
    setSelectedWeekdays(prev => {
      const n = new Set(prev)
      n.has(dow) ? n.delete(dow) : n.add(dow)
      // If exactly one day is now selected, update times from staff working hours
      if (n.size === 1) {
        const activeDow = Array.from(n)[0]
        const staffTimes = getStaffTimes(form.region, activeDow)
        if (staffTimes) setForm(f => ({ ...f, start_time: staffTimes.start, end_time: staffTimes.end }))
      }
      return n
    })
  }

  // Bulk
  const toggleBulkWeekday = (dow: number) => {
    setBulkWeekdays(prev => { const n = new Set(prev); n.has(dow) ? n.delete(dow) : n.add(dow); return n })
  }
  const monthStart = `${bulkYear}-${String(bulkMonth+1).padStart(2,'0')}-01`
  const monthEnd   = toLocalDateString(new Date(bulkYear, bulkMonth+1, 0))
  const bulkDates  = bulkMode === 'week'
    ? getDatesInRange(bulkStartDate, bulkEndDate, bulkWeekdays)
    : getDatesInRange(monthStart, monthEnd, bulkWeekdays)
  const bulkPreviewSlots = generateTimeSlots(bulkForm.start_time, bulkForm.end_time, SLOT_SPACING)

  // Actually perform the bulk save
  const doBulkActualSave = async (save: PendingSave) => {
    setBulkSaving(true)
    let created = 0; let skipped = 0
    try {
      for (const date of save.dates) {
        // Skip only if same region already exists for this date
        if (availByDate.get(date)?.some(e => e.region === save.region)) { skipped++; continue }
        const res = await fetch('/api/admin/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, region: save.region, slots: save.slots, max_per_slot: 1, notes: save.notes || undefined }) })
        if (res.ok) created++; else skipped++
      }
      await loadAvailability()
      setBulkResult(`${created} dag${created!==1?'en':''} toegevoegd${skipped>0?`, ${skipped} overgeslagen (al ingepland)`:''}.`)
      setConflictInfo(null)
      setPendingSave(null)
    } finally { setBulkSaving(false) }
  }

  const handleBulkSave = async () => {
    setBulkError(''); setBulkResult(null)
    if (!bulkForm.region) { setBulkError('Regio is verplicht'); return }
    if (bulkPreviewSlots.length === 0) { setBulkError('Geen tijdslots — controleer begin- en eindtijd'); return }
    if (bulkDates.length === 0) { setBulkError('Geen dagen in dit bereik'); return }

    // Check for conflicting slots on same day, different region
    const conflicts = checkConflicts(bulkDates, bulkPreviewSlots, bulkForm.region)
    if (conflicts.length > 0) {
      setConflictInfo(conflicts)
      setPendingSave({ dates: bulkDates, slots: bulkPreviewSlots, region: bulkForm.region, notes: bulkForm.notes.trim(), editingId: null, selectedDate: null })
      setConflictIsBulk(true)
      return
    }

    await doBulkActualSave({ dates: bulkDates, slots: bulkPreviewSlots, region: bulkForm.region, notes: bulkForm.notes.trim(), editingId: null, selectedDate: null })
  }

  // Compute all dates for the single-day modal (accounts for multi-weekday selection)
  const allModalDates: string[] = selectedDate
    ? form.recurrence === 'none'
      ? Array.from(selectedWeekdays).sort().map(dow => getWeekdayInSameWeek(selectedDate, dow))
      : Array.from(selectedWeekdays).sort()
          .flatMap(dow => expandRecurrence(getWeekdayInSameWeek(selectedDate, dow), form.recurrence, form.until_date))
          .filter((d, i, arr) => arr.indexOf(d) === i)
          .sort()
    : []

  // Compute save button label
  const saveLabel = editingId
    ? 'Bijwerken'
    : allModalDates.length > 1
    ? `${allModalDates.length} dagen toevoegen`
    : 'Toevoegen'

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Beschikbaarheid</h1>
          <p className="text-gravida-sage mt-1">Klik op een dag om beschikbaarheid toe te voegen of te bewerken.</p>
        </div>
        <button onClick={() => { setBulkOpen(true); setBulkError(''); setBulkResult(null) }} className="btn-primary shrink-0">
          + Bulk toevoegen
        </button>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">‹</button>
          <h2 className="section-title">{DUTCH_MONTHS[calMonth]} {calYear}</h2>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DUTCH_DAYS_SHORT.map((d) => <div key={d} className="text-center text-xs font-medium text-gravida-light-sage py-1">{d}</div>)}
        </div>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gravida-light-sage">Laden...</div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDow }).map((_,i) => <div key={`e-${i}`}/>)}
            {days.map((dateStr) => {
              const dayNum    = parseInt(dateStr.split('-')[2], 10)
              const dayEntries = (availByDate.get(dateStr) ?? []).filter(a => a.is_active)
              const isToday   = dateStr === todayStr
              const isPast    = dateStr < todayStr
              return (
                <div key={dateStr}
                  className={`relative min-h-[72px] rounded-xl p-2 text-left transition-all duration-150 border-2
                    ${isToday?'border-gravida-sage':'border-transparent'}
                    ${dayEntries.length>0?'bg-gravida-sage/10':isPast?'opacity-40':''}
                    ${isPast?'cursor-default':''}`}>
                  <span className={`text-sm font-semibold ${isToday?'text-gravida-sage':'text-gravida-green'}`}>{dayNum}</span>

                  {/* One clickable block per availability entry */}
                  {dayEntries.map(a => (
                    <button key={a.id} onClick={() => openEditModal(a)}
                      className="w-full text-left mt-1 rounded-lg hover:bg-white/50 transition-colors -mx-0.5 px-0.5 py-0.5">
                      <p className="text-xs text-gravida-sage leading-tight truncate font-medium">{a.region}</p>
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {a.slots.map(slot => (
                          <span key={slot} title={slot + (a.booked_slots?.includes(slot) ? ' (geboekt)' : ' (vrij)')}
                            className={`w-2 h-2 rounded-full shrink-0 ${a.booked_slots?.includes(slot) ? 'bg-red-400' : 'bg-gravida-sage/50'}`}/>
                        ))}
                      </div>
                      {(a.booked_slots?.length ?? 0) > 0 ? (
                        <div className="leading-tight">
                          <p className="text-xs text-red-400">{a.booked_slots.join(' · ')} vol</p>
                          {a.slots.length - a.booked_slots.length > 0 &&
                            <p className="text-xs text-gravida-light-sage">{a.slots.length - a.booked_slots.length} vrij</p>
                          }
                        </div>
                      ) : (
                        <p className="text-xs text-gravida-light-sage">{a.slots.length} vrij</p>
                      )}
                    </button>
                  ))}

                  {/* Add link */}
                  {!isPast && (
                    <button onClick={() => openAddModal(dateStr)}
                      className={`text-xs mt-1 w-full text-left transition-colors hover:text-gravida-sage
                        ${dayEntries.length>0?'text-gravida-sage/30':'text-gravida-cream'}`}>
                      + {dayEntries.length>0?'meer':'toevoegen'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming list */}
      <div className="card mt-6">
        <h2 className="section-title mb-4">Komende beschikbaarheid</h2>
        {availability.filter(a=>a.date>=todayStr&&a.is_active).length===0 ? (
          <p className="text-gravida-light-sage text-sm">Geen beschikbaarheid ingesteld.</p>
        ) : (
          <div className="space-y-2">
            {availability.filter(a=>a.date>=todayStr&&a.is_active).slice(0,10).map((avail)=>(
              <div key={avail.id} className="flex items-center justify-between py-3 border-b border-gravida-cream last:border-0">
                <div>
                  <p className="font-medium text-sm">{formatDutchDate(avail.date)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm text-gravida-sage">{avail.region}</p>
                    {(avail.booked_slots?.length ?? 0) > 0
                      ? <span className="text-xs text-red-500 font-medium">{avail.booked_slots.join(' · ')} vol{avail.slots.length - avail.booked_slots.length > 0 ? ` · ${avail.slots.length - avail.booked_slots.length} vrij` : ''}</span>
                      : <span className="text-xs text-gravida-light-sage">{avail.slots.length} vrij</span>
                    }
                  </div>
                  {avail.notes&&<p className="text-xs text-gravida-light-sage italic">{avail.notes}</p>}
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={()=>openEditModal(avail)} className="btn-secondary text-sm px-3 py-1.5">Bewerken</button>
                  <button onClick={()=>setDeleteConfirm(avail.id)} className="btn-danger text-sm px-3 py-1.5">Verwijderen</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Single-day modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream">
              <h3 className="section-title">{editingId?'Beschikbaarheid bewerken':'Beschikbaarheid toevoegen'}</h3>
              {selectedDate&&<p className="text-gravida-sage text-sm mt-1">{formatDutchDate(selectedDate)}</p>}
            </div>

            <div className="p-6 space-y-5">
              {error&&<div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>}

              {/* Slot-status overview — only when editing */}
              {editingId && editingAvail && editingAvail.slots.length > 0 && (
                <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-3">
                  <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Bezetting</p>
                  <div className="flex flex-wrap gap-1.5">
                    {editingAvail.slots.map(slot => {
                      const booked = editingAvail.booked_slots?.includes(slot)
                      const [h, m] = slot.split(':').map(Number)
                      const endMin = h * 60 + m + 60
                      const end = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`
                      return (
                        <span key={slot} className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5
                          ${booked ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gravida-sage/10 text-gravida-green border border-gravida-sage/20'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${booked ? 'bg-red-400' : 'bg-gravida-sage'}`}/>
                          {slot}–{end}
                          {booked && <span className="font-normal opacity-70">vol</span>}
                        </span>
                      )
                    })}
                  </div>
                  {(editingAvail.booked_slots?.length ?? 0) === 0 && (
                    <p className="text-xs text-gravida-light-sage mt-1">Nog geen boekingen op deze dag.</p>
                  )}
                </div>
              )}

              {/* Region */}
              <div>
                <label className="label">Regio *</label>
                <select className="input-field" value={form.region} onChange={(e) => {
                    const newRegion = e.target.value
                    // If a single weekday is selected, update times from the new region's staff hours
                    if (selectedWeekdays.size === 1) {
                      const dow = Array.from(selectedWeekdays)[0]
                      const staffTimes = getStaffTimes(newRegion, dow)
                      if (staffTimes) {
                        setForm(f => ({ ...f, region: newRegion, start_time: staffTimes.start, end_time: staffTimes.end }))
                        return
                      }
                    }
                    setForm(f => ({ ...f, region: newRegion }))
                  }}>
                  {REGIONS.map((r)=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Begintijd *</label>
                  <input type="time" className="input-field" value={form.start_time} onChange={(e)=>setForm({...form,start_time:e.target.value})}/>
                </div>
                <div>
                  <label className="label">Eindtijd *</label>
                  <input type="time" className="input-field" value={form.end_time} onChange={(e)=>setForm({...form,end_time:e.target.value})}/>
                </div>
              </div>

              {/* Slot info */}
              <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-3 text-sm text-gravida-sage">
                <span className="font-medium text-gravida-green">Tijdslots:</span> 60 min afspraak + 30 min reistijd per slot
              </div>

              {/* Weekday toggles — only when adding new */}
              {!editingId && selectedDate && (
                <div>
                  <label className="label">Weekdagen</label>
                  <div className="flex gap-2 flex-wrap">
                    {DUTCH_DAYS_SHORT.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleModalWeekday(i)}
                        className={`w-11 h-11 rounded-xl text-sm font-medium border-2 transition-colors
                          ${selectedWeekdays.has(i)
                            ? 'border-gravida-sage bg-gravida-sage text-white'
                            : 'border-gravida-cream text-gravida-light-sage hover:border-gravida-sage/40'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recurrence — only when adding new */}
              {!editingId && selectedDate && (
                <div>
                  <label className="label">Herhaling</label>
                  <div className="space-y-2">
                    {(['none','weekly','biweekly','monthly'] as RecurrenceType[]).map((r)=>{
                      const label = r==='none' ? 'Niet herhaald' : recurrenceLabel(r, selectedDate)
                      return (
                        <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors
                          ${form.recurrence===r?'border-gravida-sage bg-gravida-sage/5':'border-gravida-cream hover:border-gravida-sage/30'}`}>
                          <input type="radio" name="recurrence" value={r} checked={form.recurrence===r} onChange={()=>setRecurrence(r)} className="accent-gravida-sage"/>
                          <span className="text-sm">{label}</span>
                        </label>
                      )
                    })}
                  </div>

                  {form.recurrence !== 'none' && (
                    <div className="mt-3">
                      <label className="label">Herhalen t/m</label>
                      <input type="date" className="input-field" value={form.until_date}
                        min={selectedDate}
                        onChange={(e)=>setForm({...form,until_date:e.target.value})}/>
                      {allModalDates.length > 0 && (
                        <p className="text-xs text-gravida-sage mt-1.5">
                          {allModalDates.length} dag{allModalDates.length!==1?'en':''} worden aangemaakt
                          {allModalDates.length <= 6 && `: ${allModalDates.map(d=>d.split('-').slice(1).join('/')).join(', ')}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="label">Opmerkingen (optioneel)</label>
                <input type="text" className="input-field" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} placeholder="bijv. parkeren mogelijk op de oprit"/>
              </div>

              {/* Preview slots */}
              <div>
                <label className="label">Tijdslots ({previewSlots.length})</label>
                <div className="flex flex-wrap gap-2 p-3 bg-gravida-off-white rounded-xl border border-gravida-cream">
                  {previewSlots.length===0
                    ? <span className="text-gravida-light-sage text-sm">Geen tijdslots — controleer begin-/eindtijd</span>
                    : previewSlots.map((s)=>(
                      <span key={s} className="px-2.5 py-1 bg-gravida-sage/20 text-gravida-green rounded-lg text-xs font-medium">
                        {s}–{(() => { const [h,m]=s.split(':').map(Number); const e=h*60+m+60; return `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}` })()}
                      </span>
                    ))
                  }
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gravida-cream flex gap-3 justify-end">
              <button onClick={()=>setModalOpen(false)} className="btn-secondary" disabled={saving}>Annuleren</button>
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving?<span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Opslaan...</span>:saveLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk modal ── */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream">
              <h3 className="section-title">Bulk beschikbaarheid toevoegen</h3>
              <p className="text-gravida-sage text-sm mt-1">Voeg meerdere dagen tegelijk in.</p>
            </div>
            <div className="p-6 space-y-5">
              {bulkError&&<div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{bulkError}</div>}
              {bulkResult&&<div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">✓ {bulkResult}</div>}

              <div>
                <label className="label">Periode</label>
                <div className="flex gap-2">
                  {(['week','month'] as const).map((m)=>(
                    <button key={m} onClick={()=>setBulkMode(m)} className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors
                      ${bulkMode===m?'border-gravida-sage bg-gravida-sage/10 text-gravida-green':'border-gravida-cream text-gravida-light-sage hover:border-gravida-sage/40'}`}>
                      {m==='week'?'Week / Datumbereik':'Hele maand'}
                    </button>
                  ))}
                </div>
              </div>

              {bulkMode==='week' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Startdatum</label><input type="date" className="input-field" value={bulkStartDate} onChange={(e)=>setBulkStartDate(e.target.value)}/></div>
                  <div><label className="label">Einddatum</label><input type="date" className="input-field" value={bulkEndDate} onChange={(e)=>setBulkEndDate(e.target.value)}/></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Maand</label><select className="input-field" value={bulkMonth} onChange={(e)=>setBulkMonth(parseInt(e.target.value))}>{DUTCH_MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}</select></div>
                  <div><label className="label">Jaar</label><select className="input-field" value={bulkYear} onChange={(e)=>setBulkYear(parseInt(e.target.value))}>{[today.getFullYear(),today.getFullYear()+1].map((y)=><option key={y} value={y}>{y}</option>)}</select></div>
                </div>
              )}

              <div>
                <label className="label">Weekdagen</label>
                <div className="flex gap-2 flex-wrap">
                  {DUTCH_DAYS_SHORT.map((d,i)=>(
                    <button key={i} onClick={()=>toggleBulkWeekday(i)} className={`w-11 h-11 rounded-xl text-sm font-medium border-2 transition-colors
                      ${bulkWeekdays.has(i)?'border-gravida-sage bg-gravida-sage text-white':'border-gravida-cream text-gravida-light-sage hover:border-gravida-sage/40'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-gravida-cream"/>

              <div>
                <label className="label">Regio *</label>
                <select className="input-field" value={bulkForm.region} onChange={(e)=>setBulkForm({...bulkForm,region:e.target.value})}>
                  {REGIONS.map((r)=><option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Begintijd *</label><input type="time" className="input-field" value={bulkForm.start_time} onChange={(e)=>setBulkForm({...bulkForm,start_time:e.target.value})}/></div>
                <div><label className="label">Eindtijd *</label><input type="time" className="input-field" value={bulkForm.end_time} onChange={(e)=>setBulkForm({...bulkForm,end_time:e.target.value})}/></div>
              </div>

              <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-3 text-sm text-gravida-sage">
                <span className="font-medium text-gravida-green">Tijdslots:</span> 60 min afspraak + 30 min reistijd per slot
              </div>

              <div>
                <label className="label">Opmerkingen (optioneel)</label>
                <input type="text" className="input-field" value={bulkForm.notes} onChange={(e)=>setBulkForm({...bulkForm,notes:e.target.value})} placeholder="bijv. parkeren mogelijk op de oprit"/>
              </div>

              <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-4">
                <p className="text-sm font-medium text-gravida-green mb-1">Voorvertoning</p>
                <p className="text-sm text-gravida-sage">
                  {bulkDates.length===0?'Geen dagen in dit bereik':`${bulkDates.length} dag${bulkDates.length!==1?'en':''} · ${bulkPreviewSlots.length} tijdslots per dag`}
                </p>
                {bulkDates.length>0&&bulkDates.length<=7&&<p className="text-xs text-gravida-light-sage mt-1">{bulkDates.map(formatDutchDate).join(' · ')}</p>}
                {bulkDates.length>7&&<p className="text-xs text-gravida-light-sage mt-1">{formatDutchDate(bulkDates[0])} t/m {formatDutchDate(bulkDates[bulkDates.length-1])}</p>}
              </div>
            </div>

            <div className="p-6 border-t border-gravida-cream flex gap-3 justify-end">
              <button onClick={()=>setBulkOpen(false)} className="btn-secondary" disabled={bulkSaving}>Sluiten</button>
              <button onClick={handleBulkSave} className="btn-primary" disabled={bulkSaving||bulkDates.length===0}>
                {bulkSaving?<span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Bezig...</span>:`${bulkDates.length} dag${bulkDates.length!==1?'en':''} toevoegen`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Conflict warning modal ── */}
      {conflictInfo !== null && pendingSave !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-amber-100 bg-amber-50 rounded-t-2xl">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">⚠️</span>
                <h3 className="font-semibold text-amber-800 text-lg">Overlappende tijdslots</h3>
              </div>
              <p className="text-amber-700 text-sm">
                {conflictInfo.length === 1
                  ? 'Op één dag overlappen de nieuwe tijdslots met beschikbaarheid voor een andere regio.'
                  : `Op ${conflictInfo.length} dagen overlappen de nieuwe tijdslots met beschikbaarheid voor een andere regio.`}
              </p>
            </div>

            <div className="p-6 space-y-3">
              {conflictInfo.slice(0, 5).map((c, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                  <p className="text-sm font-semibold text-amber-900">{formatDutchDate(c.date)}</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Al ingepland voor: <span className="font-medium">{c.region}</span>
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Overlappende slots: <span className="font-medium">{c.overlapping.join(', ')}</span>
                  </p>
                </div>
              ))}
              {conflictInfo.length > 5 && (
                <p className="text-xs text-gravida-light-sage pl-1">…en nog {conflictInfo.length - 5} meer conflicten.</p>
              )}

              <p className="text-sm text-gravida-sage pt-1">
                Wil je toch doorgaan met opslaan, of annuleren om de tijden aan te passen?
              </p>
            </div>

            <div className="p-6 border-t border-gravida-cream flex gap-3 justify-end">
              <button
                onClick={() => { setConflictInfo(null); setPendingSave(null) }}
                className="btn-secondary"
                disabled={saving || bulkSaving}
              >
                Annuleren
              </button>
              <button
                onClick={async () => {
                  if (!pendingSave) return
                  if (conflictIsBulk) await doBulkActualSave(pendingSave)
                  else await doActualSave(pendingSave)
                }}
                className="px-5 py-2.5 rounded-xl font-medium text-sm bg-amber-600 hover:bg-amber-700 text-white transition-colors disabled:opacity-50"
                disabled={saving || bulkSaving}
              >
                {(saving || bulkSaving)
                  ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Opslaan...</span>
                  : 'Toch opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm!==null&&(
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h3 className="section-title mb-2">Beschikbaarheid verwijderen?</h3>
            <p className="text-gravida-sage text-sm mb-6">Dit verwijdert de beschikbaarheid definitief. Bestaande boekingen blijven behouden.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setDeleteConfirm(null)} className="btn-secondary">Annuleren</button>
              <button onClick={()=>handleDelete(deleteConfirm)} className="btn-danger px-6 py-3">Verwijderen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
