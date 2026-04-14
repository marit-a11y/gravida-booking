'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getDaysInMonth, getFirstDayOfWeek, formatDutchDate, toLocalDateString } from '@/lib/utils'
import { trackPixel } from '@/components/MetaPixel'

// Slug → display name
const REGION_MAP: Record<string, string> = {
  'noord-brabant':                'Noord-Brabant',
  'noord-holland-flevoland':      'Noord-Holland & Flevoland',
  'utrecht-gelderland-overijssel':'Utrecht & Gelderland & Overijssel',
  'zuid-holland':                 'Zuid-Holland',
  'limburg':                      'Limburg',
  'groningen-friesland-drenthe':  'Groningen, Friesland en Drenthe',
  'showroom-haarlem':             'Showroom bezoek Haarlem',
  'haarlem-studioscan':           'Haarlem studioscan',
  'curacao':                      'Curacao',
}

interface AvailabilityEntry {
  id: number; date: string; region: string; slots: string[]; max_per_slot: number; notes: string | null
}
interface SlotWithCount { slot: string; count: number; available: boolean }
type Step = 'calendar' | 'slots' | 'form' | 'loading' | 'done'

const DUTCH_MONTHS    = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const DUTCH_DAYS_SHORT = ['Ma','Di','Wo','Do','Vr','Za','Zo']

// Per-region info blocks shown above the booking form
const REGION_INFO: Record<string, { text: string; travelFee?: string; diy?: boolean }> = {
  'Noord-Brabant': {
    text: 'Wij plannen 3Dscans aan huis per regio efficiënt op vaste routes. Indien nodig nemen we contact met je op om het gekozen tijdslot in overleg iets aan te passen.',
    travelFee: '€49',
    diy: true,
  },
  'Zuid-Holland': {
    text: 'Wij plannen 3Dscans aan huis per regio efficiënt op vaste routes. Indien nodig nemen we contact met je op om het gekozen tijdslot in overleg iets aan te passen.',
    travelFee: '€29',
    diy: true,
  },
  'Noord-Holland & Flevoland': {
    text: 'Wij plannen 3Dscans aan huis per regio efficiënt op vaste routes. Indien nodig nemen we contact met je op om het gekozen tijdslot in overleg iets aan te passen.',
    travelFee: '€19',
    diy: true,
  },
  'Utrecht & Gelderland & Overijssel': {
    text: 'Wij plannen 3Dscans aan huis per regio efficiënt op vaste routes. Indien nodig nemen we contact met je op om het gekozen tijdslot in overleg iets aan te passen.',
    travelFee: '€49',
    diy: true,
  },
  'Limburg': {
    text: 'Wij plannen 3Dscans aan huis per regio efficiënt op vaste routes. Indien nodig nemen we contact met je op om het gekozen tijdslot in overleg iets aan te passen.',
    travelFee: '€49',
    diy: true,
  },
  'Groningen, Friesland en Drenthe': {
    text: 'Wij plannen 3Dscans aan huis per regio efficiënt op vaste routes. Indien nodig nemen we contact met je op om het gekozen tijdslot in overleg iets aan te passen.',
    travelFee: '€49',
    diy: true,
  },
}

// ─── Artificial scarcity ────────────────────────────────────────────────────
// Returns a deterministic set of slot strings that appear "full" to the visitor,
// even though they are still free in the backend.
// Rules: leave 1 or 2 real slots bookable; fake-booked slots are consecutive
// so the day looks genuinely busy (ochtend vol, nog 1 middag vrij).
function getFakeBookedSlots(date: string, region: string, allSlots: SlotWithCount[]): Set<string> {
  const free = allSlots.filter(s => s.available)
  if (free.length <= 1) return new Set() // Nothing to fake if only 1 real slot

  // Deterministic hash of date + region — stable across refreshes / devices
  let seed = 0
  for (const ch of date + region) seed = ((seed * 31) + ch.charCodeAt(0)) >>> 0

  // Leave 1 slot free (~40% of days) or 2 slots free (~60% of days)
  const minFree = (seed % 5 < 2) ? 1 : 2
  const fakeCount = free.length - minFree
  if (fakeCount <= 0) return new Set()

  // Bundle from a seed-based start so pattern varies across days
  const maxStart = free.length - fakeCount
  const startIdx = seed % (maxStart + 1)

  return new Set(free.slice(startIdx, startIdx + fakeCount).map(s => s.slot))
}

function notifyHeight(containerEl?: HTMLElement | null) {
  if (typeof window === 'undefined') return
  requestAnimationFrame(() => {
    const h = containerEl
      ? Math.round(containerEl.getBoundingClientRect().height)
      : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    window.parent.postMessage({ type: 'gravida-resize', height: h }, '*')
  })
}

export default function EmbedBookingPage({ params }: { params: { regio: string } }) {
  const regionName = REGION_MAP[params.regio] ?? params.regio
  const today = new Date()
  const todayStr = toLocalDateString(today)

  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [availableDates, setAvailableDates] = useState<AvailabilityEntry[]>([])
  const [loadingDates, setLoadingDates] = useState(true)
  const [step, setStep]         = useState<Step>('calendar')
  const [selectedDate, setSelectedDate]   = useState<string | null>(null)
  const [selectedAvail, setSelectedAvail] = useState<AvailabilityEntry | null>(null)
  const [slots, setSlots]       = useState<SlotWithCount[]>([])
  const [selectedSlot, setSelectedSlot]   = useState<string | null>(null)
  const [booking, setBooking]   = useState<{ customer_number: string } | null>(null)

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address: '', zip_code: '', city: '', pregnancy_weeks: '', notes: '',
  })
  const [errors, setErrors]       = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Notify parent of height after every step change, using the container's actual painted height
  useEffect(() => {
    const el = containerRef.current
    const send = () => notifyHeight(el)
    send()
    const t1 = setTimeout(send, 80)
    const t2 = setTimeout(send, 300)
    const t3 = setTimeout(send, 800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [step])

  // Also track any size changes via ResizeObserver (debounced to prevent resize loop on mobile)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const el = containerRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => notifyHeight(el), 120)
    })
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(timer) }
  }, [])

  const loadDates = useCallback(async () => {
    setLoadingDates(true)
    try {
      const res = await fetch(`/api/availability?region=${encodeURIComponent(regionName)}`)
      if (res.ok) setAvailableDates(await res.json())
    } finally { setLoadingDates(false) }
  }, [regionName])

  useEffect(() => { loadDates() }, [loadDates])

  const availSet = new Set(availableDates.map(a => a.date))
  const days     = getDaysInMonth(calYear, calMonth)
  const firstDow = getFirstDayOfWeek(calYear, calMonth)

  const prevMonth = () => { if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }

  const handleDateClick = async (dateStr: string) => {
    if (!availSet.has(dateStr)) return
    const avail = availableDates.find(a => a.date === dateStr)
    if (!avail) return
    setSelectedDate(dateStr); setSelectedAvail(avail); setSelectedSlot(null)
    const res = await fetch(`/api/availability/${avail.id}`)
    if (res.ok) setSlots((await res.json()).slots)
    setStep('slots')
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSlotSelect = (slot: string) => {
    setSelectedSlot(slot); setStep('form')
    trackPixel('InitiateCheckout', {
      content_name: 'Zwangerschapsscan-boeking',
      content_category: regionName,
    })
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const validateForm = () => {
    const e: Record<string, string> = {}
    if (!form.first_name.trim()) e.first_name = 'Voornaam is verplicht'
    if (!form.last_name.trim())  e.last_name  = 'Achternaam is verplicht'
    if (!form.email.trim())      e.email      = 'E-mailadres is verplicht'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ongeldig e-mailadres'
    if (!form.phone.trim())      e.phone      = 'Telefoonnummer is verplicht'
    if (!form.address.trim())    e.address    = 'Adres is verplicht'
    if (!form.zip_code.trim())   e.zip_code   = 'Postcode is verplicht'
    if (!form.city.trim())       e.city       = 'Woonplaats is verplicht'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateForm(); setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setStep('loading'); setSubmitError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availability_id: selectedAvail!.id,
          time_slot: selectedSlot,
          first_name: form.first_name.trim(), last_name: form.last_name.trim(),
          email: form.email.trim(), phone: form.phone.trim(),
          address: form.address.trim(), city: form.city.trim(),
          zip_code: form.zip_code.trim(),
          pregnancy_weeks: form.pregnancy_weeks ? parseInt(form.pregnancy_weeks) : undefined,
          notes: form.notes.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSubmitError(d.error ?? 'Er ging iets mis. Probeer het opnieuw.')
        setStep('form'); return
      }
      const bookingData = await res.json()
      setBooking(bookingData); setStep('done')
      // Meta Pixel — Lead (client-side, deduped met server CAPI via meta_event_id)
      trackPixel(
        'Lead',
        {
          content_name: 'Zwangerschapsscan-boeking',
          content_category: regionName,
          currency: 'EUR',
        },
        bookingData.meta_event_id,
      )
    } catch {
      setSubmitError('Er ging iets mis. Controleer uw internetverbinding.')
      setStep('form')
    }
  }

  const handleBack = () => {
    if (step === 'form') setStep('slots')
    else if (step === 'slots') setStep('calendar')
  }

  const inp = (field: string, extra?: string) =>
    `w-full px-4 py-3 rounded-xl border-2 text-sm transition-colors outline-none focus:border-[#5e7763] ${errors[field] ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'} ${extra ?? ''}`

  // ── Step indicator
  const stepIdx = step === 'calendar' ? 0 : step === 'slots' ? 1 : step === 'done' ? 3 : 2
  const steps   = ['Datum', 'Tijdslot', 'Gegevens', 'Bevestigd']

  const info = REGION_INFO[regionName]

  return (
    <div ref={containerRef} style={{ fontFamily: "'Inter', system-ui, sans-serif", color: '#2d3b2e', background: '#fff', padding: '0 0 24px' }}>

      {/* Info block — shown above the booking form */}
      {info && step !== 'done' && (
        <div style={{ marginBottom: 24, padding: '20px 24px', background: '#f5f9f5', borderRadius: 14, borderLeft: '4px solid #5e7763' }}>
          <p style={{ fontSize: 14, color: '#3d5c40', lineHeight: 1.6, margin: 0 }}>{info.text}</p>
          {info.travelFee && (
            <p style={{ fontSize: 14, color: '#3d5c40', lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
              Voor deze regio geldt een vaste reiskostenvergoeding van <strong>{info.travelFee}</strong> per afspraak.
            </p>
          )}
          {info.diy && (
            <p style={{ fontSize: 14, color: '#3d5c40', lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
              Liever zelf scannen? Je kunt onze{' '}
              <a href="https://www.gravida.nl/diy-3d-zwangerschapsscan/" style={{ color: '#5e7763', fontWeight: 500 }}>DIY 3D scan kit</a>{' '}
              gratis gebruiken tegen een borg.
            </p>
          )}
        </div>
      )}

      {/* Step indicator */}
      {step !== 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          {steps.slice(0, 3).map((label, i) => {
            const active = i === stepIdx, done = i < stepIdx
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600,
                  background: active || done ? '#5e7763' : '#e8ede8',
                  color: active || done ? '#fff' : '#9aad9a',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#2d3b2e' : '#9aad9a' }}>{label}</span>
                {i < 2 && <div style={{ width: 24, height: 2, background: done ? '#5e7763' : '#e8ede8', borderRadius: 2 }}/>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── CALENDAR ── */}
      {step === 'calendar' && (
        <div>
          {loadingDates ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9aad9a', fontSize: 14 }}>Beschikbaarheid laden...</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e8ede8', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{DUTCH_MONTHS[calMonth]} {calYear}</span>
                <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e8ede8', background: '#fff', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 8 }}>
                {DUTCH_DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#9aad9a', fontWeight: 500, padding: '4px 0' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                {Array.from({ length: firstDow }).map((_,i) => <div key={`e-${i}`}/>)}
                {days.map(dateStr => {
                  const dayNum  = parseInt(dateStr.split('-')[2], 10)
                  const avail   = availSet.has(dateStr)
                  const isPast  = dateStr < todayStr
                  const isToday = dateStr === todayStr
                  return (
                    <button key={dateStr} onClick={() => handleDateClick(dateStr)} disabled={!avail || isPast}
                      style={{
                        minHeight: 44, borderRadius: 10, border: isToday ? '2px solid #5e7763' : '2px solid transparent',
                        background: avail && !isPast ? '#5e7763' : 'transparent',
                        color: avail && !isPast ? '#fff' : isPast ? '#ccc' : '#9aad9a',
                        fontWeight: avail && !isPast ? 600 : 400, fontSize: 13,
                        cursor: avail && !isPast ? 'pointer' : 'default',
                        transition: 'all .15s', opacity: isPast ? .4 : 1,
                      }}
                      onMouseEnter={e => { if (avail && !isPast) (e.currentTarget as HTMLElement).style.background = '#4a6350' }}
                      onMouseLeave={e => { if (avail && !isPast) (e.currentTarget as HTMLElement).style.background = '#5e7763' }}>
                      {dayNum}
                    </button>
                  )
                })}
              </div>
              {availableDates.filter(a => a.date >= todayStr).length === 0 && (
                <p style={{ textAlign: 'center', color: '#9aad9a', marginTop: 16, fontSize: 14 }}>Geen beschikbare datums gevonden. Kijk later nog eens.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── SLOTS ── */}
      {step === 'slots' && selectedAvail && (() => {
        const fakeBooked = getFakeBookedSlots(selectedAvail.date, selectedAvail.region, slots)
        const realFreeCount = slots.filter(s => s.available && !fakeBooked.has(s.slot)).length
        return (
          <div>
            <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5e7763', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>
              ← Terug naar kalender
            </button>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{formatDutchDate(selectedAvail.date)}</h3>
              <p style={{ color: '#6b8c6e', fontSize: 13, marginBottom: realFreeCount > 0 && realFreeCount <= 3 ? 8 : 20 }}>Kies een tijdslot voor jouw scan aan huis</p>

              {/* Urgency notice */}
              {realFreeCount === 1 && (
                <div style={{ background: '#fff3e0', border: '1px solid #f4a535', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⚠️</span>
                  <p style={{ color: '#b45309', fontSize: 13, fontWeight: 700, margin: 0 }}>
                    Let op: er is nog maar 1 tijdslot beschikbaar!
                  </p>
                </div>
              )}
              {realFreeCount >= 2 && realFreeCount <= 3 && (
                <p style={{ color: '#c0622a', fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  🔥 Nog {realFreeCount} tijdsloten beschikbaar
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
                {slots.map(s => {
                  const [h, m] = s.slot.split(':').map(Number)
                  const endMin = h * 60 + m + 60
                  const endStr = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`
                  const isTaken = !s.available || fakeBooked.has(s.slot)

                  if (isTaken) {
                    return (
                      <div key={s.slot} style={{ padding: '12px 8px', borderRadius: 12, border: '2px solid #e5e7eb', background: '#f9fafb', color: '#9ca3af', fontSize: 14, textAlign: 'center', userSelect: 'none' }}>
                        <div style={{ fontWeight: 600, textDecoration: 'line-through' }}>{s.slot}–{endStr}</div>
                        <div style={{ fontSize: 11, marginTop: 3, color: '#d1a57a', fontWeight: 500 }}>Vol</div>
                      </div>
                    )
                  }

                  return (
                    <button key={s.slot} onClick={() => handleSlotSelect(s.slot)}
                      style={{ padding: '12px 8px', borderRadius: 12, border: '2px solid #5e7763', background: '#fff', color: '#2d3b2e', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all .15s', textAlign: 'center' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#5e7763'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff'; (e.currentTarget as HTMLElement).style.color = '#2d3b2e' }}>
                      {s.slot}–{endStr}
                    </button>
                  )
                })}
                {realFreeCount === 0 && (
                  <p style={{ color: '#9aad9a', fontSize: 14 }}>Geen beschikbare tijdslots meer op deze dag.</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── FORM ── */}
      {(step === 'form' || step === 'loading') && selectedAvail && selectedSlot && (
        <div>
          <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5e7763', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, marginBottom: 16 }}>
            ← Terug
          </button>
          <div style={{ background: '#f5ede6', borderRadius: 16, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📅</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{formatDutchDate(selectedAvail.date)} · {selectedSlot}–{(() => { const [h,m] = selectedSlot.split(':').map(Number); const e = h*60+m+60; return `${String(Math.floor(e/60)).padStart(2,'0')}:${String(e%60).padStart(2,'0')}` })()}</p>
              <p style={{ fontSize: 13, color: '#7a6a5a', marginTop: 2 }}>3D zwangerschapsscan · {selectedAvail.region}</p>
            </div>
          </div>

          {submitError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>{submitError}</div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Voornaam *</label>
                  <input className={inp('first_name')} type="text" value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} placeholder="Anna"/>
                  {errors.first_name && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.first_name}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Achternaam *</label>
                  <input className={inp('last_name')} type="text" value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} placeholder="de Vries"/>
                  {errors.last_name && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.last_name}</p>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>E-mailadres *</label>
                  <input className={inp('email')} type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="anna@email.nl"/>
                  {errors.email && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.email}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Telefoonnummer *</label>
                  <input className={inp('phone')} type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="06 12345678"/>
                  {errors.phone && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.phone}</p>}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Straat + huisnummer *</label>
                <input className={inp('address')} type="text" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="Kerkstraat 12"/>
                {errors.address && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.address}</p>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Postcode *</label>
                  <input className={inp('zip_code')} type="text" value={form.zip_code} onChange={e => setForm(f => ({...f, zip_code: e.target.value}))} placeholder="1234 AB"/>
                  {errors.zip_code && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.zip_code}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Woonplaats *</label>
                  <input className={inp('city')} type="text" value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="Eindhoven"/>
                  {errors.city && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{errors.city}</p>}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Aantal weken zwanger op moment van de scan</label>
                <input className={inp('pregnancy_weeks')} type="number" min="16" max="40" value={form.pregnancy_weeks} onChange={e => setForm(f => ({...f, pregnancy_weeks: e.target.value}))} placeholder="bijv. 28"/>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Opmerkingen (optioneel)</label>
                <textarea className={inp('notes')} rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Bijv. tweeling, eerder bezoek, toegankelijkheid..." style={{ resize: 'vertical' }}/>
              </div>

              <button type="submit" disabled={step === 'loading'}
                style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: step === 'loading' ? '#9aad9a' : '#5e7763', color: '#fff', border: 'none', fontWeight: 600, fontSize: 15, cursor: step === 'loading' ? 'not-allowed' : 'pointer', transition: 'background .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {step === 'loading' ? (
                  <><span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }}/>Bezig met boeken...</>
                ) : 'Afspraak bevestigen →'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── CONFIRMATION ── */}
      {step === 'done' && booking && (
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#5e7763', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>✓</div>
          <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Afspraak bevestigd!</h2>
          <p style={{ color: '#6b8c6e', marginBottom: 24 }}>We sturen een bevestiging naar {form.email}.</p>
          <div style={{ background: '#f5f9f5', borderRadius: 12, padding: 20, textAlign: 'left', marginBottom: 24 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['Klantnummer', `#${booking.customer_number}`],
                ['Datum', selectedDate ? formatDutchDate(selectedDate) : ''],
                ['Tijdslot', selectedSlot ?? ''],
                ['Naam', `${form.first_name} ${form.last_name}`],
                ['Adres', `${form.address}, ${form.zip_code} ${form.city}`],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ fontSize: 13, color: '#9aad9a', minWidth: 100 }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#9aad9a' }}>Vragen? Mail naar <a href="mailto:hi@gravida.nl" style={{ color: '#5e7763' }}>hi@gravida.nl</a></p>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}
