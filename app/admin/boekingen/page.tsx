'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDutchDateShort } from '@/lib/utils'

interface Booking {
  id: number
  customer_number: string
  first_name: string
  last_name: string
  email: string
  phone: string
  time_slot: string
  date: string
  region: string
  address: string
  city: string
  zip_code: string
  pregnancy_weeks: number | null
  notes: string | null
  internal_notes: string | null
  status: string
  created_at: string
  availability_id?: number
}

interface AvailabilityEntry {
  id: number
  date: string
  region: string
  slots: string[]
  max_per_slot: number
  is_active: boolean
  is_closed: boolean
}

const STATUSES = ['alle', 'bevestigd', 'afgerond', 'geannuleerd']

const ALL_REGIONS = [
  'Noord-Holland & Flevoland',
  'Utrecht & Gelderland & Overijssel',
  'Zuid-Holland',
  'Noord-Brabant',
  'Limburg',
  'Groningen, Friesland en Drenthe',
  'Showroom bezoek Haarlem',
  'Haarlem studioscan',
  'Family scan Haarlem',
  'Curacao',
  'DIY scan',
]

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  zip_code: '',
  pregnancy_weeks: '',
  notes: '',
}

export default function BoekingenPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterDate, setFilterDate] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterStatus, setFilterStatus] = useState('alle')
  const [filterCustomerNumber, setFilterCustomerNumber] = useState('')
  const [sortNewest, setSortNewest] = useState(false)
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Booking> & { pregnancy_weeks_str?: string }>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  // New booking modal state
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState(EMPTY_FORM)
  const [availabilityList, setAvailabilityList] = useState<AvailabilityEntry[]>([])
  const [selectedRegion, setSelectedRegion] = useState('')
  const [selectedAvailId, setSelectedAvailId] = useState<number | null>(null)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [newBookingLoading, setNewBookingLoading] = useState(false)
  const [newBookingError, setNewBookingError] = useState('')
  const [newBookingSuccess, setNewBookingSuccess] = useState('')

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams()
      if (filterDate) params.set('date', filterDate)
      if (filterRegion.trim()) params.set('region', filterRegion.trim())
      if (filterStatus !== 'alle') params.set('status', filterStatus)

      const res = await fetch(`/api/admin/bookings?${params}`)
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings ?? [])
      } else {
        const data = await res.json().catch(() => ({}))
        setLoadError(data.error ?? `Fout ${res.status} — probeer opnieuw in te loggen.`)
        setBookings([])
      }
    } catch {
      setLoadError('Verbindingsfout — controleer je internetverbinding.')
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [filterDate, filterRegion, filterStatus])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  // Client-side customer number filter + sort
  const filteredBookings = filterCustomerNumber.trim()
    ? bookings.filter(b =>
        b.customer_number.includes(filterCustomerNumber.trim()) ||
        `${b.first_name} ${b.last_name}`.toLowerCase().includes(filterCustomerNumber.trim().toLowerCase())
      )
    : bookings

  const displayedBookings = sortNewest
    ? [...filteredBookings].sort((a, b) => b.created_at.localeCompare(a.created_at))
    : filteredBookings

  // Save the edit modal form, optionally also sending an update-email afterwards
  const saveEdit = async (alsoSendMail: boolean) => {
    if (!detailBooking) return
    setEditSaving(true); setEditError('')
    try {
      const payload = {
        first_name: editForm.first_name?.trim(),
        last_name: editForm.last_name?.trim(),
        email: editForm.email?.trim().toLowerCase(),
        phone: editForm.phone?.trim(),
        address: editForm.address?.trim(),
        city: editForm.city?.trim(),
        zip_code: editForm.zip_code?.trim(),
        pregnancy_weeks: editForm.pregnancy_weeks_str ? parseInt(editForm.pregnancy_weeks_str, 10) : null,
        notes: editForm.notes?.trim() || null,
        internal_notes: editForm.internal_notes?.trim() || null,
        availability_id: editForm.availability_id,
        time_slot: editForm.time_slot,
      }
      const res = await fetch(`/api/admin/bookings/${detailBooking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setEditError(data.error ?? 'Opslaan mislukt')
        return
      }
      // Save succeeded — optional follow-up mail
      if (alsoSendMail) {
        const mailRes = await fetch(`/api/admin/bookings/${detailBooking.id}/send-update-email`, { method: 'POST' })
        if (!mailRes.ok) {
          const md = await mailRes.json().catch(() => ({}))
          alert('Wijzigingen opgeslagen, maar mail versturen mislukte: ' + (md.error ?? 'onbekend'))
        } else {
          alert('Opgeslagen + update-mail verstuurd naar klant en medewerker.')
        }
      }
      setEditMode(false)
      await loadBookings()
      setDetailBooking(null)
    } catch {
      setEditError('Verbindingsfout')
    } finally {
      setEditSaving(false)
    }
  }

  const handleStatusChange = async (id: number, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status } : b))
        if (detailBooking?.id === id) {
          setDetailBooking((prev) => prev ? { ...prev, status } : null)
        }
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const handleExportCsv = async () => {
    const params = new URLSearchParams()
    if (filterDate) params.set('date', filterDate)
    if (filterRegion.trim()) params.set('region', filterRegion.trim())
    if (filterStatus !== 'alle') params.set('status', filterStatus)
    params.set('export', 'csv')

    const res = await fetch(`/api/admin/bookings?${params}`)
    if (!res.ok) return

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gravida-boekingen-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasActiveFilters = filterDate || filterRegion || filterStatus !== 'alle' || filterCustomerNumber
  const clearFilters = () => {
    setFilterDate('')
    setFilterRegion('')
    setFilterStatus('alle')
    setFilterCustomerNumber('')
  }

  // ─── New booking helpers ───────────────────────────────────────────────────
  const [manualDate, setManualDate] = useState('')
  const [manualSlot, setManualSlot] = useState('')

  const openNewModal = async () => {
    setShowNewModal(true)
    setNewForm(EMPTY_FORM)
    setSelectedRegion('')
    setSelectedAvailId(null)
    setSelectedSlot('')
    setManualDate('')
    setManualSlot('')
    setNewBookingError('')
    setNewBookingSuccess('')
    try {
      const res = await fetch('/api/admin/availability')
      if (res.ok) {
        const data = await res.json()
        setAvailabilityList(
          (data.availability ?? []).filter((a: AvailabilityEntry) => a.is_active && !a.is_closed)
        )
      }
    } catch { /* ignore */ }
  }

  const datesForRegion = availabilityList
    .filter(a => a.region === selectedRegion)
    .sort((a, b) => a.date.localeCompare(b.date))
  const hasAvailability = datesForRegion.length > 0
  const slotsForAvail = availabilityList.find(a => a.id === selectedAvailId)?.slots ?? []

  const handleNewBooking = async () => {
    if (!selectedRegion) {
      setNewBookingError('Selecteer een regio.')
      return
    }
    // When there's availability, use it; otherwise use manual input
    if (hasAvailability && (!selectedAvailId || !selectedSlot)) {
      setNewBookingError('Selecteer een datum en tijdslot.')
      return
    }
    if (!hasAvailability && (!manualDate || !manualSlot)) {
      setNewBookingError('Vul een datum en tijdslot in.')
      return
    }
    const required = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'zip_code'] as const
    for (const f of required) {
      if (!newForm[f].trim()) {
        setNewBookingError('Vul alle verplichte velden in.')
        return
      }
    }
    setNewBookingLoading(true)
    setNewBookingError('')
    try {
      // If no availability entry exists, auto-create one
      let availId = selectedAvailId
      let timeSlot = selectedSlot

      if (!hasAvailability || !availId) {
        timeSlot = manualSlot
        // Create an availability entry on-the-fly
        const availRes = await fetch('/api/admin/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: manualDate,
            region: selectedRegion,
            slots: [manualSlot],
            max_per_slot: 2,
          }),
        })
        if (!availRes.ok) {
          setNewBookingError('Kon beschikbaarheid niet aanmaken.')
          setNewBookingLoading(false)
          return
        }
        const availData = await availRes.json()
        availId = availData.availability.id
      }

      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability_id: availId,
          time_slot: timeSlot,
          ...newForm,
          pregnancy_weeks: newForm.pregnancy_weeks || undefined,
          notes: newForm.notes || undefined,
        }),
      })
      if (res.ok) {
        const booking = await res.json()
        setNewBookingSuccess(`Boeking aangemaakt — klantnummer ${booking.customer_number}`)
        loadBookings()
      } else {
        const data = await res.json().catch(() => ({}))
        setNewBookingError(data.error ?? 'Boeking aanmaken mislukt.')
      }
    } catch {
      setNewBookingError('Verbindingsfout.')
    } finally {
      setNewBookingLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Boekingen</h1>
          <p className="text-gravida-sage mt-1">
            {loading ? 'Laden...' : `${displayedBookings.length} boeking${displayedBookings.length !== 1 ? 'en' : ''} gevonden`}
            {filterCustomerNumber.trim() && bookings.length !== displayedBookings.length && (
              <span className="ml-1 text-xs">({bookings.length} totaal)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={openNewModal} className="btn-primary flex items-center gap-2 text-sm">
            <span>+</span> <span className="hidden sm:inline">Nieuwe</span> boeking
          </button>
          <button onClick={handleExportCsv} className="btn-secondary flex items-center gap-2 text-sm">
            <span>↓</span> <span className="hidden sm:inline">Exporteer</span> CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Customer number / name search */}
          <div>
            <label className="label">Klantnummer / naam</label>
            <input
              type="text"
              className="input-field"
              value={filterCustomerNumber}
              onChange={(e) => setFilterCustomerNumber(e.target.value)}
              placeholder="bijv. 3164 of Manuela"
            />
          </div>
          <div>
            <label className="label">Afspraakdatum</label>
            <input
              type="date"
              className="input-field"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Regio</label>
            <input
              type="text"
              className="input-field"
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              placeholder="Zoek op regio..."
            />
          </div>
          <div>
            <label className="label">Status</label>
            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s === 'alle' ? 'Alle statussen' : s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <label className="flex items-center gap-2 text-xs text-gravida-sage cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sortNewest}
              onChange={(e) => setSortNewest(e.target.checked)}
              className="rounded border-gravida-cream accent-gravida-green"
            />
            Sorteer op nieuwste reserveringen
          </label>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-gravida-sage hover:text-gravida-green underline"
            >
              Filters wissen
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {loadError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
          <span>⚠️ {loadError}</span>
          <button onClick={loadBookings} className="text-xs underline ml-4">Opnieuw proberen</button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">
            <div className="w-6 h-6 border-3 border-gravida-sage border-t-transparent rounded-full animate-spin mr-2" />
            Laden...
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">
            {hasActiveFilters ? 'Geen boekingen gevonden voor deze filters.' : 'Nog geen boekingen.'}
          </div>
        ) : (
          <>
          {/* Mobile cards */}
          <div className="sm:hidden p-4 space-y-3">
            {displayedBookings.map((b) => (
              <div key={b.id} className="border border-gravida-cream rounded-xl p-4 space-y-2" onClick={() => setDetailBooking(b)}>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-gravida-sage text-sm">{b.customer_number}</span>
                  <select
                    value={b.status}
                    disabled={updatingId === b.id}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleStatusChange(b.id, e.target.value)}
                    className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer outline-none ${
                      b.status === 'bevestigd' ? 'bg-green-100 text-green-700' :
                      b.status === 'geannuleerd' ? 'bg-red-100 text-red-700' :
                      b.status === 'afgerond' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <option value="bevestigd">bevestigd</option>
                    <option value="afgerond">afgerond</option>
                    <option value="geannuleerd">geannuleerd</option>
                  </select>
                </div>
                <p className="font-medium">{b.first_name} {b.last_name}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gravida-sage">
                  <span>{b.date ? formatDutchDateShort(b.date) : '—'}</span>
                  <span>{b.time_slot}</span>
                </div>
                <p className="text-xs text-gravida-light-sage truncate">{b.region ?? '—'}</p>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gravida-cream/50">
                <tr>
                  {['Nr', 'Naam', 'Afspraak', 'Tijdslot', 'Regio', 'Geboekt op', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gravida-light-sage whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gravida-cream">
                {displayedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gravida-off-white transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-gravida-sage whitespace-nowrap">
                      {b.customer_number}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {b.first_name} {b.last_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gravida-sage">
                      {b.date ? formatDutchDateShort(b.date) : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.time_slot}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate text-gravida-sage">{b.region ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gravida-light-sage text-xs">
                      {b.created_at ? formatDutchDateShort(b.created_at.split(' ')[0]) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={b.status}
                        disabled={updatingId === b.id}
                        onChange={(e) => handleStatusChange(b.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer outline-none ${
                          b.status === 'bevestigd' ? 'bg-green-100 text-green-700' :
                          b.status === 'geannuleerd' ? 'bg-red-100 text-red-700' :
                          b.status === 'afgerond' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        <option value="bevestigd">bevestigd</option>
                        <option value="afgerond">afgerond</option>
                        <option value="geannuleerd">geannuleerd</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDetailBooking(b)}
                        className="text-gravida-sage hover:text-gravida-green text-xs underline whitespace-nowrap"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* New booking modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <h2 className="text-lg font-bold text-gravida-sage">Nieuwe boeking</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {newBookingSuccess ? (
                <div className="text-center py-6">
                  <p className="text-green-700 font-semibold text-lg mb-2">{newBookingSuccess}</p>
                  <button onClick={() => setShowNewModal(false)} className="btn-primary mt-4">Sluiten</button>
                </div>
              ) : (
                <>
                  {/* Afspraak selectie */}
                  <Section title="Afspraak">
                    <div className="space-y-3">
                      <div>
                        <label className="label">Regio *</label>
                        <select
                          className="input-field"
                          value={selectedRegion}
                          onChange={(e) => {
                            setSelectedRegion(e.target.value)
                            setSelectedAvailId(null)
                            setSelectedSlot('')
                          }}
                        >
                          <option value="">Selecteer regio...</option>
                          {ALL_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      {selectedRegion && hasAvailability && (
                        <div>
                          <label className="label">Datum *</label>
                          <select
                            className="input-field"
                            value={selectedAvailId ?? ''}
                            onChange={(e) => {
                              setSelectedAvailId(Number(e.target.value) || null)
                              setSelectedSlot('')
                            }}
                          >
                            <option value="">Selecteer datum...</option>
                            {datesForRegion.map(a => (
                              <option key={a.id} value={a.id}>
                                {new Date(a.date + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {selectedAvailId && (
                        <div>
                          <label className="label">Tijdslot *</label>
                          <select
                            className="input-field"
                            value={selectedSlot}
                            onChange={(e) => setSelectedSlot(e.target.value)}
                          >
                            <option value="">Selecteer tijdslot...</option>
                            {slotsForAvail.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      )}
                      {selectedRegion && !hasAvailability && (
                        <>
                          <p className="text-xs text-gravida-light-sage">Geen beschikbaarheid gevonden — vul handmatig in:</p>
                          <div>
                            <label className="label">Datum *</label>
                            <input type="date" className="input-field" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                          </div>
                          <div>
                            <label className="label">Tijdslot *</label>
                            <input type="time" className="input-field" value={manualSlot} onChange={e => setManualSlot(e.target.value)} placeholder="bijv. 14:00" />
                          </div>
                        </>
                      )}
                    </div>
                  </Section>

                  {/* Klantgegevens */}
                  <Section title="Klantgegevens">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Voornaam *</label>
                        <input className="input-field" value={newForm.first_name} onChange={e => setNewForm(f => ({ ...f, first_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Achternaam *</label>
                        <input className="input-field" value={newForm.last_name} onChange={e => setNewForm(f => ({ ...f, last_name: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">E-mail *</label>
                        <input type="email" className="input-field" value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Telefoon *</label>
                        <input className="input-field" value={newForm.phone} onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Adres *</label>
                        <input className="input-field" value={newForm.address} onChange={e => setNewForm(f => ({ ...f, address: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Postcode *</label>
                        <input className="input-field" value={newForm.zip_code} onChange={e => setNewForm(f => ({ ...f, zip_code: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Stad *</label>
                        <input className="input-field" value={newForm.city} onChange={e => setNewForm(f => ({ ...f, city: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Weken zwanger</label>
                        <input type="number" className="input-field" value={newForm.pregnancy_weeks} onChange={e => setNewForm(f => ({ ...f, pregnancy_weeks: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="label">Opmerkingen</label>
                        <textarea className="input-field" rows={2} value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                    </div>
                  </Section>

                  {newBookingError && (
                    <p className="text-red-600 text-sm">{newBookingError}</p>
                  )}

                  <button
                    onClick={handleNewBooking}
                    disabled={newBookingLoading}
                    className="btn-primary w-full"
                  >
                    {newBookingLoading ? 'Bezig...' : 'Boeking aanmaken'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailBooking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <div>
                <p className="text-xs text-gravida-light-sage uppercase tracking-wide font-medium mb-0.5">Klantnummer</p>
                <p className="text-3xl font-bold font-mono text-gravida-sage">{detailBooking.customer_number}</p>
              </div>
              <button
                onClick={() => { setDetailBooking(null); setEditMode(false); setEditError('') }}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage"
              >
                ✕
              </button>
            </div>

            {!editMode ? (
              <div className="p-6 space-y-4">
                <Section title="Klantgegevens">
                  <Row label="Naam" value={`${detailBooking.first_name} ${detailBooking.last_name}`} />
                  <Row label="E-mail" value={detailBooking.email} />
                  <Row label="Telefoon" value={detailBooking.phone} />
                  <Row label="Adres" value={`${detailBooking.address}, ${detailBooking.zip_code} ${detailBooking.city}`} />
                  {detailBooking.pregnancy_weeks && (
                    <Row label="Weken zwanger" value={`${detailBooking.pregnancy_weeks} weken`} />
                  )}
                </Section>

                <Section title="Afspraakdetails">
                  <Row label="Datum" value={detailBooking.date ? formatDutchDateShort(detailBooking.date) : '—'} />
                  <Row label="Tijdslot" value={detailBooking.time_slot} />
                  <Row label="Regio" value={detailBooking.region ?? '—'} />
                </Section>

                {detailBooking.notes && (
                  <Section title="Opmerkingen klant">
                    <p className="text-sm text-gravida-sage italic">{detailBooking.notes}</p>
                  </Section>
                )}

                {detailBooking.internal_notes && (
                  <Section title="Interne opmerkingen">
                    <p className="text-sm text-amber-700 italic whitespace-pre-wrap">{detailBooking.internal_notes}</p>
                  </Section>
                )}

                <div>
                  <label className="label">Status wijzigen</label>
                  <div className="flex gap-2">
                    {['bevestigd', 'afgerond', 'geannuleerd'].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(detailBooking.id, s)}
                        disabled={detailBooking.status === s || updatingId === detailBooking.id}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors border ${
                          detailBooking.status === s
                            ? s === 'bevestigd' ? 'bg-green-100 text-green-700 border-green-200' :
                              s === 'geannuleerd' ? 'bg-red-100 text-red-700 border-red-200' :
                              'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-white border-gravida-cream text-gravida-light-sage hover:border-gravida-sage hover:text-gravida-sage'
                        } disabled:cursor-default`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={async () => {
                    // Load availability list for rescheduling — include the booking's current
                    // availability even if it's closed/inactive so the admin can pick its slots
                    try {
                      const res = await fetch('/api/admin/availability')
                      if (res.ok) {
                        const data = await res.json()
                        const all: AvailabilityEntry[] = data.availability ?? []
                        const currentId = detailBooking.availability_id
                        const visible = all.filter(a =>
                          (a.is_active && !a.is_closed) || a.id === currentId
                        )
                        setAvailabilityList(visible)
                      }
                    } catch { /* ignore */ }
                    setEditForm({
                      first_name: detailBooking.first_name,
                      last_name: detailBooking.last_name,
                      email: detailBooking.email,
                      phone: detailBooking.phone,
                      address: detailBooking.address,
                      city: detailBooking.city,
                      zip_code: detailBooking.zip_code,
                      pregnancy_weeks_str: detailBooking.pregnancy_weeks?.toString() ?? '',
                      notes: detailBooking.notes ?? '',
                      internal_notes: detailBooking.internal_notes ?? '',
                      availability_id: detailBooking.availability_id,
                      time_slot: detailBooking.time_slot,
                    })
                    setEditMode(true)
                    setEditError('')
                  }}
                  className="w-full py-2 rounded-lg text-sm font-medium border border-gravida-cream text-gravida-sage hover:border-gravida-sage transition-colors"
                >
                  ✎ Bewerken
                </button>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Voornaam</label>
                    <input className="input-field" value={editForm.first_name ?? ''} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Achternaam</label>
                    <input className="input-field" value={editForm.last_name ?? ''} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">E-mail</label>
                    <input type="email" className="input-field" value={editForm.email ?? ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Telefoon</label>
                    <input className="input-field" value={editForm.phone ?? ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Adres</label>
                    <input className="input-field" value={editForm.address ?? ''} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Postcode</label>
                    <input className="input-field" value={editForm.zip_code ?? ''} onChange={e => setEditForm(f => ({ ...f, zip_code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Stad</label>
                    <input className="input-field" value={editForm.city ?? ''} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Weken zwanger</label>
                    <input type="number" className="input-field" value={editForm.pregnancy_weeks_str ?? ''} onChange={e => setEditForm(f => ({ ...f, pregnancy_weeks_str: e.target.value }))} />
                  </div>
                </div>

                <Section title="Afspraak wijzigen">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="label">Datum &amp; regio</label>
                      <select
                        className="input-field"
                        value={editForm.availability_id ?? ''}
                        onChange={e => {
                          const id = Number(e.target.value)
                          const sel = availabilityList.find(a => a.id === id)
                          setEditForm(f => ({ ...f, availability_id: id, time_slot: sel?.slots[0] ?? f.time_slot }))
                        }}
                      >
                        {detailBooking.availability_id && !availabilityList.some(a => a.id === detailBooking.availability_id) && (
                          <option value={detailBooking.availability_id}>
                            Huidig: {detailBooking.date ? formatDutchDateShort(detailBooking.date) : '?'} · {detailBooking.region}
                          </option>
                        )}
                        {availabilityList.sort((a, b) => a.date.localeCompare(b.date)).map(a => (
                          <option key={a.id} value={a.id}>
                            {formatDutchDateShort(a.date)} · {a.region}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Tijdslot</label>
                      {(() => {
                        const sel = availabilityList.find(a => a.id === editForm.availability_id)
                        const slots = sel?.slots ?? (editForm.time_slot ? [editForm.time_slot] : [])
                        return (
                          <select
                            className="input-field"
                            value={editForm.time_slot ?? ''}
                            onChange={e => setEditForm(f => ({ ...f, time_slot: e.target.value }))}
                          >
                            {slots.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )
                      })()}
                    </div>
                  </div>
                </Section>

                <div>
                  <label className="label">Opmerkingen klant</label>
                  <textarea className="input-field" rows={2} value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <div>
                  <label className="label">Interne opmerkingen (niet zichtbaar voor klant)</label>
                  <textarea className="input-field" rows={3} value={editForm.internal_notes ?? ''} onChange={e => setEditForm(f => ({ ...f, internal_notes: e.target.value }))} />
                </div>

                {editError && <p className="text-red-600 text-sm">{editError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditMode(false); setEditError('') }}
                    className="flex-1 py-2 rounded-lg text-sm font-medium border border-gravida-cream text-gravida-light-sage hover:border-gravida-sage transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={() => saveEdit(false)}
                    disabled={editSaving}
                    className="flex-1 btn-secondary"
                  >
                    {editSaving ? 'Opslaan...' : '💾 Opslaan'}
                  </button>
                </div>

                <button
                  onClick={() => saveEdit(true)}
                  disabled={editSaving}
                  className="w-full mt-2 py-2 rounded-lg text-sm font-medium bg-gravida-sage text-white hover:bg-gravida-green transition-colors disabled:opacity-50"
                  type="button"
                  title="Slaat eerst op en stuurt daarna direct de update-mail naar de klant + medewerker met de net opgeslagen gegevens"
                >
                  {editSaving ? 'Bezig...' : '💾 Opslaan + 📧 stuur update-mail'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gravida-cream last:border-0">
      <span className="text-sm text-gravida-light-sage">{label}</span>
      <span className="text-sm font-medium text-right ml-4">{value}</span>
    </div>
  )
}
