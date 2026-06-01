'use client'

import { Fragment, useEffect, useState } from 'react'
import { formatDutchDate, formatDutchDateShort, toLocalDateString } from '@/lib/utils'
import ClarityWidget from '@/app/admin/components/ClarityWidget'

interface Stats {
  total: number
  thisWeek: number
  today: number
}

interface Booking {
  id: number
  customer_number: string
  first_name: string
  last_name: string
  email?: string
  time_slot: string
  date: string
  region: string
  phone: string
  address?: string
  city?: string
  zip_code?: string
  pregnancy_weeks?: number | null
  notes?: string | null
  status: string
  created_at?: string
}

interface Availability {
  id: number
  date: string
  region: string
  slots: string[]
  max_per_slot: number
  is_active: boolean
}

function getWeekDays(): string[] {
  const days: string[] = []
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(toLocalDateString(d))
  }
  return days
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [todayBookings, setTodayBookings] = useState<Booking[]>([])
  const [newReservations, setNewReservations] = useState<Booking[]>([])
  const [weekAvailability, setWeekAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)

  const weekDays = getWeekDays()
  const todayStr = toLocalDateString(new Date())

  useEffect(() => {
    const load = async () => {
      try {
        const [statsRes, bookingsRes, newResRes, availRes] = await Promise.all([
          fetch('/api/admin/bookings?stats=1'),
          fetch(`/api/admin/bookings?date=${todayStr}`),
          fetch('/api/admin/bookings?created_today=1'),
          fetch('/api/admin/availability'),
        ])

        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.stats)
        }
        if (bookingsRes.ok) {
          const data = await bookingsRes.json()
          setTodayBookings(data.bookings ?? [])
        }
        if (newResRes.ok) {
          const data = await newResRes.json()
          setNewReservations(data.bookings ?? [])
        }
        if (availRes.ok) {
          const data = await availRes.json()
          const thisWeek = (data.availability ?? []).filter((a: Availability) =>
            weekDays.includes(a.date)
          )
          setWeekAvailability(thisWeek)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [todayStr])

  const DUTCH_DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-gravida-sage border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gravida-sage mt-1">
          {formatDutchDate(todayStr)}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="card">
          <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Vandaag</p>
          <p className="text-4xl font-bold text-gravida-green">{stats?.today ?? 0}</p>
          <p className="text-sm text-gravida-sage mt-1">afspraken</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Deze week</p>
          <p className="text-4xl font-bold text-gravida-green">{stats?.thisWeek ?? 0}</p>
          <p className="text-sm text-gravida-sage mt-1">afspraken</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Totaal</p>
          <p className="text-4xl font-bold text-gravida-green">{stats?.total ?? 0}</p>
          <p className="text-sm text-gravida-sage mt-1">boekingen</p>
        </div>
      </div>

      {/* Weekly calendar */}
      <div className="card mb-8">
        <h2 className="section-title mb-4">Deze week</h2>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {weekDays.map((day, i) => {
            const avail = weekAvailability.find((a) => a.date === day)
            const isToday = day === todayStr
            const isPast = day < todayStr
            return (
              <div
                key={day}
                className={`rounded-xl p-2 sm:p-3 text-center transition-colors ${
                  isToday ? 'bg-gravida-green text-white' :
                  isPast ? 'bg-gravida-cream/50' : 'bg-gravida-cream'
                }`}
              >
                <p className={`text-xs font-medium mb-1 ${isToday ? 'text-gravida-light-sage' : 'text-gravida-light-sage'}`}>
                  {DUTCH_DAYS[i]}
                </p>
                <p className={`text-lg font-semibold ${isToday ? 'text-white' : 'text-gravida-green'}`}>
                  {parseInt(day.split('-')[2], 10)}
                </p>
                {avail ? (
                  <div className="mt-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-gravida-sage" />
                    <p className={`text-xs mt-1 truncate ${isToday ? 'text-white/80' : 'text-gravida-sage'}`}>
                      {avail.region}
                    </p>
                    <p className={`text-xs ${isToday ? 'text-white/60' : 'text-gravida-light-sage'}`}>
                      {avail.slots.length} slots
                    </p>
                  </div>
                ) : (
                  <p className={`text-xs mt-2 ${isToday ? 'text-white/50' : 'text-gravida-light-sage'}`}>–</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Clarity widget */}
      <div className="mb-8">
        <ClarityWidget />
      </div>

      {/* Today's appointments */}
      <div className="card mb-8">
        <h2 className="section-title mb-4">Afspraken vandaag</h2>
        {todayBookings.length === 0 ? (
          <p className="text-gravida-light-sage text-sm py-4 text-center">
            Geen afspraken vandaag.
          </p>
        ) : (
          <BookingList bookings={todayBookings} mode="today" />
        )}
      </div>

      {/* New reservations (booked today) */}
      <div className="card">
        <h2 className="section-title mb-1">Nieuwe reserveringen</h2>
        <p className="text-xs text-gravida-light-sage mb-4">Vandaag geboekt, voor welke datum dan ook.</p>
        {newReservations.length === 0 ? (
          <p className="text-gravida-light-sage text-sm py-4 text-center">
            Nog geen nieuwe reserveringen vandaag.
          </p>
        ) : (
          <BookingList bookings={newReservations} mode="new" />
        )}
      </div>
    </div>
  )
}

function BookingList({ bookings, mode }: { bookings: Booking[]; mode: 'today' | 'new' }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {bookings.map((b) => {
          const isOpen = expanded.has(b.id)
          return (
            <div key={b.id} className="border border-gravida-cream rounded-xl">
              <button onClick={() => toggle(b.id)} className="w-full text-left p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-gravida-sage text-sm">{b.customer_number}</span>
                  <StatusBadge status={b.status} />
                </div>
                <p className="font-medium">{b.first_name} {b.last_name}</p>
                <div className="flex items-center gap-4 text-sm text-gravida-sage">
                  <span>{mode === 'new' ? formatDutchDateShort(b.date) : b.time_slot}</span>
                  <span>{mode === 'new' ? b.time_slot : b.phone}</span>
                </div>
                <p className="text-xs text-gravida-light-sage">{isOpen ? '▲ minder' : '▼ details'}</p>
              </button>
              {isOpen && <BookingDetails b={b} />}
            </div>
          )
        })}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gravida-cream">
              <th className="w-8"></th>
              <th className="text-left py-2 pr-4 font-medium text-gravida-light-sage">Nr</th>
              <th className="text-left py-2 pr-4 font-medium text-gravida-light-sage">Naam</th>
              {mode === 'new' && (
                <th className="text-left py-2 pr-4 font-medium text-gravida-light-sage">Datum</th>
              )}
              <th className="text-left py-2 pr-4 font-medium text-gravida-light-sage">Tijdslot</th>
              {mode === 'new' && (
                <th className="text-left py-2 pr-4 font-medium text-gravida-light-sage">Regio</th>
              )}
              <th className="text-left py-2 pr-4 font-medium text-gravida-light-sage">Telefoon</th>
              <th className="text-left py-2 font-medium text-gravida-light-sage">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const isOpen = expanded.has(b.id)
              return (
                <Fragment key={b.id}>
                  <tr
                    onClick={() => toggle(b.id)}
                    className="border-b border-gravida-cream last:border-0 hover:bg-gravida-off-white transition-colors cursor-pointer">
                    <td className="py-3 pr-2 text-center text-gravida-light-sage text-xs">{isOpen ? '▼' : '▶'}</td>
                    <td className="py-3 pr-4 font-mono font-semibold text-gravida-sage">{b.customer_number}</td>
                    <td className="py-3 pr-4 font-medium">{b.first_name} {b.last_name}</td>
                    {mode === 'new' && (
                      <td className="py-3 pr-4 text-gravida-sage">{formatDutchDateShort(b.date)}</td>
                    )}
                    <td className="py-3 pr-4">{b.time_slot}</td>
                    {mode === 'new' && (
                      <td className="py-3 pr-4 text-gravida-sage text-xs">{b.region}</td>
                    )}
                    <td className="py-3 pr-4 text-gravida-sage">{b.phone}</td>
                    <td className="py-3">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-gravida-cream bg-gravida-off-white/60">
                      <td colSpan={mode === 'new' ? 8 : 6} className="p-4">
                        <BookingDetails b={b} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function BookingDetails({ b }: { b: Booking }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm px-4 pb-4 sm:p-0">
      <DetailRow label="Datum" value={formatDutchDate(b.date)} />
      <DetailRow label="Tijdslot" value={b.time_slot} />
      <DetailRow label="Regio" value={b.region} />
      <DetailRow label="Telefoon" value={b.phone} />
      <DetailRow label="E-mail" value={b.email} />
      <DetailRow label="Zwangerschapsweken" value={b.pregnancy_weeks?.toString()} />
      <DetailRow label="Adres" value={[b.address, b.zip_code, b.city].filter(Boolean).join(', ')} />
      {b.notes && (
        <div className="sm:col-span-2">
          <p className="text-xs text-gravida-light-sage uppercase tracking-wide">Opmerking klant</p>
          <p className="text-gravida-green whitespace-pre-wrap">{b.notes}</p>
        </div>
      )}
      {b.created_at && (
        <DetailRow label="Geboekt op" value={formatDutchDate(b.created_at.split(' ')[0])} />
      )}
      <div className="sm:col-span-2 pt-2 flex gap-2">
        <a href={`/admin/bookings/${b.id}`} className="text-xs text-gravida-sage hover:text-gravida-green underline">
          Volledig openen ➔
        </a>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] text-gravida-light-sage uppercase tracking-wide">{label}</p>
      <p className="text-gravida-green">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    bevestigd: 'bg-green-100 text-green-700',
    geannuleerd: 'bg-red-100 text-red-700',
    afgerond: 'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}
