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
  status: string
  created_at: string
}

const STATUSES = ['alle', 'bevestigd', 'afgerond', 'geannuleerd']

export default function BoekingenPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState('')
  const [filterRegion, setFilterRegion] = useState('')
  const [filterStatus, setFilterStatus] = useState('alle')
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const loadBookings = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterDate) params.set('date', filterDate)
      if (filterRegion.trim()) params.set('region', filterRegion.trim())
      if (filterStatus !== 'alle') params.set('status', filterStatus)

      const res = await fetch(`/api/admin/bookings?${params}`)
      if (res.ok) {
        const data = await res.json()
        setBookings(data.bookings ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [filterDate, filterRegion, filterStatus])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

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

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="page-title">Boekingen</h1>
          <p className="text-gravida-sage mt-1">{bookings.length} boeking{bookings.length !== 1 ? 'en' : ''} gevonden</p>
        </div>
        <button onClick={handleExportCsv} className="btn-secondary flex items-center gap-2">
          <span>↓</span> Exporteer CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Datum</label>
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
        {(filterDate || filterRegion || filterStatus !== 'alle') && (
          <button
            onClick={() => { setFilterDate(''); setFilterRegion(''); setFilterStatus('alle') }}
            className="text-xs text-gravida-sage hover:text-gravida-green mt-3 underline"
          >
            Filters wissen
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">
            <div className="w-6 h-6 border-3 border-gravida-sage border-t-transparent rounded-full animate-spin mr-2" />
            Laden...
          </div>
        ) : bookings.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">
            Geen boekingen gevonden.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gravida-cream/50">
                <tr>
                  {['Nr', 'Naam', 'Datum', 'Tijdslot', 'Regio', 'Telefoon', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gravida-light-sage whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gravida-cream">
                {bookings.map((b) => (
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
                    <td className="px-4 py-3 whitespace-nowrap">{b.phone}</td>
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
        )}
      </div>

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
                onClick={() => setDetailBooking(null)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage"
              >
                ✕
              </button>
            </div>

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
                <Section title="Opmerkingen">
                  <p className="text-sm text-gravida-sage italic">{detailBooking.notes}</p>
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
            </div>
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
