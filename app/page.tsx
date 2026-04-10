'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getDaysInMonth, getFirstDayOfWeek, formatDutchDate, toLocalDateString } from '@/lib/utils'

interface AvailabilityEntry {
  id: number
  date: string
  region: string
  slots: string[]
  max_per_slot: number
  notes: string | null
}

interface SlotWithCount {
  slot: string
  count: number
  available: boolean
}

type Step = 'calendar' | 'slots' | 'form' | 'loading'

const DUTCH_MONTHS = [
  'Januari','Februari','Maart','April','Mei','Juni',
  'Juli','Augustus','September','Oktober','November','December',
]
const DUTCH_DAYS_SHORT = ['Ma','Di','Wo','Do','Vr','Za','Zo']

export default function BookingPage() {
  const router = useRouter()
  const today = new Date()

  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [availableDates, setAvailableDates] = useState<AvailabilityEntry[]>([])
  const [loadingDates, setLoadingDates] = useState(true)

  const [step, setStep] = useState<Step>('calendar')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedAvailability, setSelectedAvailability] = useState<AvailabilityEntry | null>(null)
  const [slots, setSlots] = useState<SlotWithCount[]>([])
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    zip_code: '',
    city: '',
    pregnancy_weeks: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')

  // Load available dates
  const loadDates = useCallback(async () => {
    setLoadingDates(true)
    try {
      const res = await fetch('/api/availability')
      if (res.ok) {
        const data = await res.json()
        setAvailableDates(data)
      }
    } finally {
      setLoadingDates(false)
    }
  }, [])

  useEffect(() => {
    loadDates()
  }, [loadDates])

  const availableDateSet = new Set(availableDates.map((a) => a.date))

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

  const handleDateClick = async (dateStr: string) => {
    if (!availableDateSet.has(dateStr)) return
    const avail = availableDates.find((a) => a.date === dateStr)
    if (!avail) return

    setSelectedDate(dateStr)
    setSelectedAvailability(avail)
    setSelectedSlot(null)

    // Load slot availability counts
    const res = await fetch(`/api/availability/${avail.id}`)
    if (res.ok) {
      const data = await res.json()
      setSlots(data.slots)
    }
    setStep('slots')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot)
    setStep('form')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validateForm = () => {
    const e: Record<string, string> = {}
    if (!form.first_name.trim()) e.first_name = 'Voornaam is verplicht'
    if (!form.last_name.trim()) e.last_name = 'Achternaam is verplicht'
    if (!form.email.trim()) e.email = 'E-mailadres is verplicht'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ongeldig e-mailadres'
    if (!form.phone.trim()) e.phone = 'Telefoonnummer is verplicht'
    if (!form.address.trim()) e.address = 'Adres is verplicht'
    if (!form.zip_code.trim()) e.zip_code = 'Postcode is verplicht'
    if (!form.city.trim()) e.city = 'Woonplaats is verplicht'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateForm()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setStep('loading')
    setSubmitError('')

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability_id: selectedAvailability!.id,
          time_slot: selectedSlot,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          zip_code: form.zip_code.trim(),
          pregnancy_weeks: form.pregnancy_weeks ? parseInt(form.pregnancy_weeks) : undefined,
          notes: form.notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setSubmitError(data.error ?? 'Er ging iets mis. Probeer het opnieuw.')
        setStep('form')
        return
      }

      const booking = await res.json()
      router.push(
        `/bevestiging?nummer=${booking.customer_number}&naam=${encodeURIComponent(form.first_name)}&datum=${selectedDate}&slot=${selectedSlot}&regio=${encodeURIComponent(selectedAvailability?.region ?? '')}`
      )
    } catch {
      setSubmitError('Er ging iets mis. Controleer uw internetverbinding en probeer het opnieuw.')
      setStep('form')
    }
  }

  const handleBack = () => {
    if (step === 'form') setStep('slots')
    else if (step === 'slots') setStep('calendar')
  }

  return (
    <div className="min-h-screen bg-gravida-off-white">
      {/* Header */}
      <header className="bg-gravida-green text-white py-6 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gravida</h1>
            <p className="text-gravida-light-sage text-sm mt-0.5">Zwangerschapsscans aan huis</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {['Datum', 'Tijdslot', 'Gegevens'].map((label, i) => {
            const stepIndex = step === 'calendar' ? 0 : step === 'slots' ? 1 : 2
            const active = i === stepIndex
            const done = i < stepIndex
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className={`h-px w-8 ${done ? 'bg-gravida-sage' : 'bg-gravida-cream'}`} />}
                <div className={`flex items-center gap-1.5 text-sm font-medium ${
                  active ? 'text-gravida-sage' : done ? 'text-gravida-light-sage' : 'text-gravida-light-sage'
                }`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    active ? 'bg-gravida-sage text-white' : done ? 'bg-gravida-light-sage text-white' : 'bg-gravida-cream text-gravida-light-sage'
                  }`}>
                    {done ? '✓' : i + 1}
                  </span>
                  {label}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── STEP: CALENDAR ── */}
        {step === 'calendar' && (
          <div className="animate-fade-in">
            <h2 className="page-title mb-2">Kies een datum</h2>
            <p className="text-gravida-sage mb-8">
              Selecteer een beschikbare dag voor uw zwangerschapsscan aan huis.
            </p>

            <div className="card">
              {/* Calendar header */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={prevMonth}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gravida-cream transition-colors"
                >
                  ‹
                </button>
                <h3 className="section-title">
                  {DUTCH_MONTHS[calMonth]} {calYear}
                </h3>
                <button
                  onClick={nextMonth}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gravida-cream transition-colors"
                >
                  ›
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DUTCH_DAYS_SHORT.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-gravida-light-sage py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              {loadingDates ? (
                <div className="h-48 flex items-center justify-center text-gravida-light-sage">
                  Beschikbaarheid laden...
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for first week */}
                  {Array.from({ length: firstDow }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {days.map((dateStr) => {
                    const dayNum = parseInt(dateStr.split('-')[2], 10)
                    const isAvailable = availableDateSet.has(dateStr)
                    const isPast = dateStr < todayStr
                    const isToday = dateStr === todayStr

                    return (
                      <button
                        key={dateStr}
                        onClick={() => handleDateClick(dateStr)}
                        disabled={!isAvailable || isPast}
                        className={`
                          calendar-day relative aspect-square rounded-xl flex flex-col items-center justify-center
                          text-sm font-medium transition-all duration-150
                          ${isPast ? 'text-gravida-cream cursor-not-allowed' : ''}
                          ${!isPast && !isAvailable ? 'text-gravida-light-sage cursor-not-allowed' : ''}
                          ${isAvailable && !isPast
                            ? 'bg-gravida-sage text-white cursor-pointer hover:bg-gravida-green'
                            : ''}
                          ${isToday && !isAvailable ? 'ring-2 ring-gravida-light-sage ring-offset-1' : ''}
                          ${isToday && isAvailable ? 'ring-2 ring-white ring-offset-2 ring-offset-gravida-sage' : ''}
                        `}
                      >
                        {dayNum}
                        {isAvailable && !isPast && (
                          <span className="w-1 h-1 rounded-full bg-white opacity-70 mt-0.5" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 pt-6 border-t border-gravida-cream text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gravida-sage" />
                  <span className="text-gravida-sage">Beschikbaar</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gravida-cream" />
                  <span className="text-gravida-light-sage">Niet beschikbaar</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: TIME SLOTS ── */}
        {step === 'slots' && selectedAvailability && (
          <div className="animate-fade-in">
            <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gravida-sage mb-4 hover:text-gravida-green transition-colors">
              ← Terug naar kalender
            </button>
            <h2 className="page-title mb-1">Kies een tijdslot</h2>
            <p className="text-gravida-sage mb-2">
              {selectedDate ? formatDutchDate(selectedDate) : ''}
            </p>
            <p className="text-sm text-gravida-light-sage mb-6">
              Regio: <span className="font-medium text-gravida-sage">{selectedAvailability.region}</span>
              {selectedAvailability.notes && (
                <span className="ml-3 italic">· {selectedAvailability.notes}</span>
              )}
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {slots.map(({ slot, available }) => (
                <button
                  key={slot}
                  onClick={() => available && handleSlotSelect(slot)}
                  disabled={!available}
                  className={`
                    py-4 rounded-xl text-center font-medium text-sm transition-all duration-150
                    ${available
                      ? 'bg-white border-2 border-gravida-sage text-gravida-green hover:bg-gravida-sage hover:text-white cursor-pointer shadow-sm'
                      : 'bg-gravida-cream border-2 border-transparent text-gravida-light-sage cursor-not-allowed line-through'
                    }
                  `}
                >
                  {slot}
                  {!available && (
                    <div className="text-xs mt-0.5 no-underline">vol</div>
                  )}
                </button>
              ))}
            </div>

            {slots.length === 0 && (
              <div className="card text-center py-12 text-gravida-light-sage">
                Geen tijdslots beschikbaar voor deze dag.
              </div>
            )}
          </div>
        )}

        {/* ── STEP: BOOKING FORM ── */}
        {(step === 'form' || step === 'loading') && selectedAvailability && selectedSlot && (
          <div className="animate-fade-in">
            <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gravida-sage mb-4 hover:text-gravida-green transition-colors">
              ← Terug naar tijdslots
            </button>

            {/* Booking summary */}
            <div className="bg-gravida-green text-white rounded-2xl p-5 mb-6">
              <p className="text-gravida-light-sage text-xs font-medium uppercase tracking-wide mb-2">Uw boeking</p>
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs text-gravida-light-sage">Datum</p>
                  <p className="font-semibold">{selectedDate ? formatDutchDate(selectedDate) : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-gravida-light-sage">Tijdslot</p>
                  <p className="font-semibold">{selectedSlot}</p>
                </div>
                <div>
                  <p className="text-xs text-gravida-light-sage">Regio</p>
                  <p className="font-semibold">{selectedAvailability.region}</p>
                </div>
              </div>
            </div>

            <h2 className="page-title mb-6">Uw gegevens</h2>

            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Voornaam *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    placeholder="Sara"
                    disabled={step === 'loading'}
                  />
                  {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>}
                </div>
                <div>
                  <label className="label">Achternaam *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    placeholder="De Vries"
                    disabled={step === 'loading'}
                  />
                  {errors.last_name && <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>}
                </div>
              </div>

              <div>
                <label className="label">E-mailadres *</label>
                <input
                  type="email"
                  className="input-field"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="sara@voorbeeld.nl"
                  disabled={step === 'loading'}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="label">Telefoonnummer *</label>
                <input
                  type="tel"
                  className="input-field"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="06 12345678"
                  disabled={step === 'loading'}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="label">Adres (straat + huisnummer) *</label>
                <input
                  type="text"
                  className="input-field"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Kerkstraat 12"
                  disabled={step === 'loading'}
                />
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Postcode *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.zip_code}
                    onChange={(e) => setForm({ ...form, zip_code: e.target.value })}
                    placeholder="1234 AB"
                    disabled={step === 'loading'}
                  />
                  {errors.zip_code && <p className="text-red-500 text-xs mt-1">{errors.zip_code}</p>}
                </div>
                <div>
                  <label className="label">Woonplaats *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Amsterdam"
                    disabled={step === 'loading'}
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
              </div>

              <div>
                <label className="label">Weken zwanger (optioneel)</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.pregnancy_weeks}
                  onChange={(e) => setForm({ ...form, pregnancy_weeks: e.target.value })}
                  placeholder="bijv. 20"
                  min={1}
                  max={45}
                  disabled={step === 'loading'}
                />
              </div>

              <div>
                <label className="label">Opmerkingen (optioneel)</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Eventuele bijzonderheden of vragen..."
                  disabled={step === 'loading'}
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={step === 'loading'}
                  className="btn-primary w-full text-base py-4"
                >
                  {step === 'loading' ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Bezig met verwerken...
                    </span>
                  ) : (
                    'Boeking bevestigen'
                  )}
                </button>
                <p className="text-xs text-center text-gravida-light-sage mt-3">
                  Na het bevestigen ontvangt u een klantnummer ter bevestiging.
                </p>
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="mt-16 py-8 border-t border-gravida-cream text-center text-sm text-gravida-light-sage">
        © {today.getFullYear()} Gravida – Zwangerschapsscans aan huis
      </footer>
    </div>
  )
}
