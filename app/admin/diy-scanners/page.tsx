'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScanConsentSection } from '@/app/admin/components/ScanConsentSection'

interface Scanner {
  id: number
  name: string
  is_available: boolean
  notes: string | null
}

interface Rental {
  id: number
  scanner_id: number
  scanner_name: string | null
  rental_week: string
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  zip_code: string
  status: string
  deposit_amount: number
  deposit_status: string
  mollie_payment_id: string | null
  payment_status: string
  customer_number: string | null
  notes: string | null
  internal_notes: string | null
  support_call_requested_at: string | null
  support_call_message: string | null
  scanner_defect: string | null
  return_received_at: string | null
  feedback_sent_at?: string | null
  feedback_submitted_at?: string | null
  scanner_issues?: string | null
  deposit_choice?: string | null
  giftcard_id?: number | null
  created_at: string
}

const RENTAL_STATUSES = ['alle', 'wacht_op_betaling', 'gereserveerd', 'verzonden', 'retour', 'uitzoeken', 'scans_uitgezocht', 'geannuleerd']

const STATUS_COLORS: Record<string, string> = {
  wacht_op_betaling: 'bg-orange-100 text-orange-700',
  gereserveerd: 'bg-yellow-100 text-yellow-700',
  verzonden: 'bg-blue-100 text-blue-700',
  retour: 'bg-purple-100 text-purple-700',
  uitzoeken: 'bg-pink-100 text-pink-700',
  scans_uitgezocht: 'bg-green-100 text-green-700',
  geannuleerd: 'bg-red-100 text-red-700',
}

const PAYMENT_COLORS: Record<string, string> = {
  open: 'bg-gray-100 text-gray-600',
  betaald: 'bg-green-100 text-green-700',
  mislukt: 'bg-red-100 text-red-700',
  teruggestort: 'bg-blue-100 text-blue-700',
}

function formatWeek(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00')
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${fmt(thu)} – ${fmt(sun)}`
}

export default function DiyScannerPage() {
  const [scanners, setScanners] = useState<Scanner[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('alle')
  const [sortOrder, setSortOrder] = useState<'week_asc' | 'week_desc' | 'created_desc'>('week_asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [updatingScanner, setUpdatingScanner] = useState<number | null>(null)
  const [updatingRental, setUpdatingRental] = useState<number | null>(null)
  const [detailRental, setDetailRental] = useState<Rental | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Rental>>({})
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [availableWeeksForEdit, setAvailableWeeksForEdit] = useState<string[]>([])

  // New rental modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([])
  const [newCustomDate, setNewCustomDate] = useState(false)
  const [newForm, setNewForm] = useState({
    rental_week: '', first_name: '', last_name: '', email: '', phone: '',
    address: '', city: '', zip_code: '', notes: '',
  })
  const [newError, setNewError] = useState('')
  const [newSuccess, setNewSuccess] = useState('')
  const [newLoading, setNewLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [scRes, renRes] = await Promise.all([
        fetch('/api/admin/diy-scanners'),
        fetch(`/api/admin/diy-rentals${filterStatus !== 'alle' ? `?status=${filterStatus}` : ''}`),
      ])
      if (scRes.ok) setScanners((await scRes.json()).scanners ?? [])
      if (renRes.ok) setRentals((await renRes.json()).rentals ?? [])
    } finally { setLoading(false) }
  }, [filterStatus])

  useEffect(() => { loadData() }, [loadData])

  const toggleScanner = async (id: number, currentAvail: boolean) => {
    setUpdatingScanner(id)
    try {
      const res = await fetch(`/api/admin/diy-scanners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !currentAvail }),
      })
      if (res.ok) {
        setScanners(prev => prev.map(s => s.id === id ? { ...s, is_available: !currentAvail } : s))
      }
    } finally { setUpdatingScanner(null) }
  }

  // Save the DIY edit form, optionally also sending an update-email afterwards
  const saveDiyEdit = async (alsoSendMail: boolean) => {
    if (!detailRental) return
    setEditSaving(true); setEditError('')
    try {
      const res = await fetch(`/api/admin/diy-rentals/${detailRental.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editForm.first_name?.trim(),
          last_name: editForm.last_name?.trim(),
          email: editForm.email?.trim().toLowerCase(),
          phone: editForm.phone?.trim(),
          address: editForm.address?.trim(),
          city: editForm.city?.trim(),
          zip_code: editForm.zip_code?.trim(),
          rental_week: editForm.rental_week,
          notes: editForm.notes?.trim() || null,
          internal_notes: editForm.internal_notes?.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setEditError(data.error ?? 'Opslaan mislukt')
        return
      }
      if (alsoSendMail) {
        const mailRes = await fetch(`/api/admin/diy-rentals/${detailRental.id}/send-update-email`, { method: 'POST' })
        if (!mailRes.ok) {
          const md = await mailRes.json().catch(() => ({}))
          alert('Wijzigingen opgeslagen, maar mail versturen mislukte: ' + (md.error ?? 'onbekend'))
        } else {
          alert('Opgeslagen + update-mail verstuurd naar klant en medewerker.')
        }
      }
      setEditMode(false)
      await loadData()
      setDetailRental(null)
    } catch {
      setEditError('Verbindingsfout')
    } finally {
      setEditSaving(false)
    }
  }

  const updateRentalStatus = async (id: number, status: string) => {
    setUpdatingRental(id)
    try {
      const res = await fetch(`/api/admin/diy-rentals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setRentals(prev => prev.map(r => r.id === id ? { ...r, status } : r))
        if (detailRental?.id === id) setDetailRental(prev => prev ? { ...prev, status } : null)
      }
    } finally { setUpdatingRental(null) }
  }

  const updateDeposit = async (id: number, deposit_status: string) => {
    setUpdatingRental(id)
    try {
      const res = await fetch(`/api/admin/diy-rentals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deposit_status }),
      })
      if (res.ok) {
        setRentals(prev => prev.map(r => r.id === id ? { ...r, deposit_status } : r))
        if (detailRental?.id === id) setDetailRental(prev => prev ? { ...prev, deposit_status } : null)
      }
    } finally { setUpdatingRental(null) }
  }

  const [returnDefect, setReturnDefect] = useState('')
  const [returnModalOpen, setReturnModalOpen] = useState(false)

  const openReturnModal = () => {
    if (!detailRental) return
    setReturnDefect(detailRental.scanner_defect ?? '')
    setReturnModalOpen(true)
  }

  const submitReturnReceived = async (sendEmail: boolean) => {
    if (!detailRental) return
    setUpdatingRental(detailRental.id)
    try {
      const res = await fetch(`/api/admin/diy-rentals/${detailRental.id}/send-return-received-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanner_defect: returnDefect.trim() || null,
          send_email: sendEmail,
          update_status: true,
        }),
      })
      if (res.ok) {
        if (sendEmail) alert('Mail verstuurd naar klant en reservering bijgewerkt.')
        else alert('Opmerking opgeslagen, geen mail verstuurd.')
        // refresh rentals
        setRentals(prev => prev.map(r => r.id === detailRental.id
          ? { ...r, scanner_defect: returnDefect.trim() || null, status: r.status === 'uitzoeken' || r.status === 'scans_uitgezocht' || r.status === 'geannuleerd' ? r.status : 'retour' }
          : r))
        setDetailRental(prev => prev ? {
          ...prev,
          scanner_defect: returnDefect.trim() || null,
          return_received_at: new Date().toISOString(),
          status: prev.status === 'uitzoeken' || prev.status === 'scans_uitgezocht' || prev.status === 'geannuleerd' ? prev.status : 'retour',
        } : null)
        setReturnModalOpen(false)
      } else {
        const data = await res.json().catch(() => ({}))
        alert('Mislukt: ' + (data.error ?? ''))
      }
    } finally { setUpdatingRental(null) }
  }

  const sendFeedbackEmail = async () => {
    if (!detailRental) return
    if (!confirm('Stuur de feedback + borg-keuze mail naar de klant?')) return
    setUpdatingRental(detailRental.id)
    try {
      const res = await fetch(`/api/admin/diy-rentals/${detailRental.id}/send-feedback-email`, {
        method: 'POST',
      })
      if (res.ok) {
        alert('Feedback-mail verstuurd')
      } else {
        const data = await res.json().catch(() => ({}))
        alert('Verzenden mislukt: ' + (data.error ?? ''))
      }
    } finally { setUpdatingRental(null) }
  }

  const sendShippedEmail = async () => {
    if (!detailRental) return
    const trackingUrl = prompt(
      'Optioneel — plak hier een track & trace link voor in de mail (laat leeg als je geen link hebt):',
      ''
    )
    if (trackingUrl === null) return  // cancel
    setUpdatingRental(detailRental.id)
    try {
      const res = await fetch(`/api/admin/diy-rentals/${detailRental.id}/send-shipped-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_url: trackingUrl.trim() || null,
          set_status: true,
        }),
      })
      if (res.ok) {
        alert('📦 Verzend-mail verstuurd en status op "verzonden" gezet.')
        setRentals(prev => prev.map(r => r.id === detailRental.id ? { ...r, status: 'verzonden' } : r))
        setDetailRental(prev => prev ? { ...prev, status: 'verzonden' } : null)
      } else {
        const data = await res.json().catch(() => ({}))
        alert('Fout: ' + (data.error ?? 'mail kon niet worden verstuurd'))
      }
    } finally { setUpdatingRental(null) }
  }

  const openNewModal = async () => {
    setShowNewModal(true)
    setNewForm({ rental_week: '', first_name: '', last_name: '', email: '', phone: '', address: '', city: '', zip_code: '', notes: '' })
    setNewCustomDate(false)
    setNewError('')
    setNewSuccess('')
    try {
      const res = await fetch('/api/diy-rentals')
      if (res.ok) setAvailableWeeks((await res.json()).weeks ?? [])
    } catch { /* ignore */ }
  }

  const handleNewRental = async () => {
    if (!newForm.rental_week) { setNewError('Selecteer een week.'); return }
    const required = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'zip_code'] as const
    for (const f of required) { if (!newForm[f].trim()) { setNewError('Vul alle verplichte velden in.'); return } }
    setNewLoading(true); setNewError('')
    try {
      const res = await fetch('/api/admin/diy-rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm),
      })
      if (res.ok) {
        setNewSuccess('Reservering aangemaakt!')
        loadData()
      } else {
        const data = await res.json().catch(() => ({}))
        setNewError(data.error ?? 'Aanmaken mislukt.')
      }
    } catch { setNewError('Verbindingsfout.') }
    finally { setNewLoading(false) }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">DIY Scanners</h1>
          <p className="text-gravida-sage mt-1">Beheer inventaris en reserveringen</p>
        </div>
        <button onClick={openNewModal} className="btn-primary flex items-center gap-2 shrink-0">
          <span>+</span> Nieuwe reservering
        </button>
      </div>

      {/* Scanner inventaris */}
      <div className="mb-8">
        <h2 className="section-title mb-3">Inventaris</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scanners.map(s => (
            <div key={s.id} className="card flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className={`text-xs ${s.is_available ? 'text-green-600' : 'text-red-500'}`}>
                  {s.is_available ? 'Beschikbaar' : 'Niet beschikbaar'}
                </p>
                {s.notes && <p className="text-xs text-gravida-light-sage mt-0.5">{s.notes}</p>}
              </div>
              <button
                onClick={() => toggleScanner(s.id, s.is_available)}
                disabled={updatingScanner === s.id}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  s.is_available
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {s.is_available ? 'Uit omloop' : 'Beschikbaar maken'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="label">🔍 Zoeken</label>
            <input className="input-field" placeholder="Naam, e-mail, klantnummer..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="label">Status</label>
            <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              {RENTAL_STATUSES.map(s => (
                <option key={s} value={s}>{s === 'alle' ? 'Alle statussen' : s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Sortering</label>
            <select className="input-field" value={sortOrder} onChange={e => setSortOrder(e.target.value as typeof sortOrder)}>
              <option value="week_asc">📅 Week — eerstvolgende eerst (oud → nieuw)</option>
              <option value="week_desc">📅 Week — laatste eerst (nieuw → oud)</option>
              <option value="created_desc">🆕 Recent geboekt eerst</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reserveringen tabel */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">
            <div className="w-6 h-6 border-3 border-gravida-sage border-t-transparent rounded-full animate-spin mr-2" />
            Laden...
          </div>
        ) : rentals.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">Geen reserveringen gevonden.</div>
        ) : (() => {
          // Apply search + sort
          const q = searchQuery.trim().toLowerCase()
          const filtered = q
            ? rentals.filter(r =>
                r.first_name.toLowerCase().includes(q) ||
                r.last_name.toLowerCase().includes(q) ||
                `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q) ||
                (r.customer_number ?? '').toLowerCase().includes(q) ||
                (r.phone ?? '').toLowerCase().includes(q) ||
                (r.city ?? '').toLowerCase().includes(q)
              )
            : rentals
          const sortedRentals = [...filtered].sort((a, b) => {
            if (sortOrder === 'created_desc') {
              return (b.created_at ?? '').localeCompare(a.created_at ?? '')
            }
            const cmp = (a.rental_week ?? '').localeCompare(b.rental_week ?? '')
            return sortOrder === 'week_desc' ? -cmp : cmp
          })
          if (sortedRentals.length === 0) {
            return (
              <div className="h-48 flex items-center justify-center text-gravida-light-sage text-sm">
                Geen reserveringen gevonden voor &quot;{searchQuery}&quot;.
              </div>
            )
          }
          return (
          <>
          {/* Mobile cards */}
          <div className="sm:hidden p-4 space-y-3">
            {sortedRentals.map(r => (
              <div key={r.id} className="border border-gravida-cream rounded-xl p-4 space-y-2" onClick={() => setDetailRental(r)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-1.5">
                      {r.first_name} {r.last_name}
                      {r.support_call_requested_at && (
                        <span title="Support call aangevraagd" className="text-purple-600">📞</span>
                      )}
                    </p>
                    {r.customer_number && <p className="font-mono text-xs text-gravida-light-sage">#{r.customer_number}</p>}
                  </div>
                  <select
                    value={r.status}
                    disabled={updatingRental === r.id}
                    onClick={(e) => e.stopPropagation()}
                    onChange={e => updateRentalStatus(r.id, e.target.value)}
                    className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer outline-none ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {RENTAL_STATUSES.filter(s => s !== 'alle').map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-gravida-sage">{formatWeek(r.rental_week)}</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${PAYMENT_COLORS[r.payment_status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {r.payment_status === 'betaald' ? 'Betaald' : r.payment_status === 'teruggestort' ? 'Teruggestort' : r.payment_status === 'mislukt' ? 'Mislukt' : 'Open'}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    r.deposit_status === 'teruggestort' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {r.deposit_status === 'teruggestort' ? 'Teruggestort' : `€${r.deposit_amount} ingehouden`}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gravida-cream/50">
                <tr>
                  {['Naam', 'Week', 'Scanner', 'Status', 'Betaling', 'Borg', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-medium text-gravida-light-sage whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gravida-cream">
                {sortedRentals.map(r => (
                  <tr key={r.id} className="hover:bg-gravida-off-white transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium flex items-center gap-1.5">
                        {r.first_name} {r.last_name}
                        {r.support_call_requested_at && (
                          <span title="Support call aangevraagd" className="text-purple-600">📞</span>
                        )}
                      </div>
                      {r.customer_number && <div className="font-mono text-xs text-gravida-light-sage">#{r.customer_number}</div>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gravida-sage">{formatWeek(r.rental_week)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{r.scanner_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        disabled={updatingRental === r.id}
                        onChange={e => updateRentalStatus(r.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer outline-none ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {RENTAL_STATUSES.filter(s => s !== 'alle').map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${PAYMENT_COLORS[r.payment_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {r.payment_status === 'betaald' ? 'Betaald' : r.payment_status === 'teruggestort' ? 'Teruggestort' : r.payment_status === 'mislukt' ? 'Mislukt' : 'Open'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        r.deposit_status === 'teruggestort' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {r.deposit_status === 'teruggestort' ? 'Teruggestort' : `€${r.deposit_amount} ingehouden`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDetailRental(r)} className="text-gravida-sage hover:text-gravida-green text-xs underline">Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
          )
        })()}
      </div>

      {/* Detail modal */}
      {detailRental && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <div>
                {detailRental.customer_number ? (
                  <>
                    <p className="text-xs text-gravida-light-sage uppercase tracking-wide font-medium mb-0.5">Klantnummer</p>
                    <p className="text-3xl font-bold font-mono text-gravida-sage">{detailRental.customer_number}</p>
                  </>
                ) : (
                  <h2 className="text-lg font-bold text-gravida-sage">Reservering details</h2>
                )}
              </div>
              <button onClick={() => { setDetailRental(null); setEditMode(false); setEditError('') }} className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage">✕</button>
            </div>
            {!editMode ? (
            <div className="p-6 space-y-4">
              {detailRental.support_call_requested_at && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-xl shrink-0">📞</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-purple-800">Support call aangevraagd</p>
                      <p className="text-[11px] text-purple-700/80">
                        {new Date(detailRental.support_call_requested_at).toLocaleString('nl-NL')}
                      </p>
                      {detailRental.support_call_message && (
                        <p className="text-xs text-purple-900 mt-2 whitespace-pre-wrap">{detailRental.support_call_message}</p>
                      )}
                      <a href={`tel:${detailRental.phone}`} className="inline-block mt-2 text-xs font-medium px-3 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700">
                        📞 Bel {detailRental.first_name}
                      </a>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Klantgegevens</p>
                <div className="space-y-1">
                  <Row label="Naam" value={`${detailRental.first_name} ${detailRental.last_name}`} />
                  <Row label="E-mail" value={detailRental.email} />
                  <Row label="Telefoon" value={detailRental.phone} />
                  <Row label="Adres" value={`${detailRental.address}, ${detailRental.zip_code} ${detailRental.city}`} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Reservering</p>
                <div className="space-y-1">
                  <Row label="Week" value={formatWeek(detailRental.rental_week)} />
                  <Row label="Scanner" value={detailRental.scanner_name ?? '—'} />
                </div>
              </div>
              {detailRental.notes && (
                <div>
                  <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Opmerkingen klant</p>
                  <p className="text-sm text-gravida-sage italic">{detailRental.notes}</p>
                </div>
              )}
              {detailRental.internal_notes && (
                <div>
                  <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Interne opmerkingen</p>
                  <p className="text-sm text-amber-700 italic whitespace-pre-wrap">{detailRental.internal_notes}</p>
                </div>
              )}

              {/* Feedback van klant op retour-mail */}
              {(detailRental.feedback_sent_at || detailRental.feedback_submitted_at || detailRental.scanner_issues || detailRental.deposit_choice) && (
                <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-3">
                  <p className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide mb-2">
                    Feedback van klant (retour-mail)
                  </p>
                  <div className="text-xs space-y-1.5">
                    {detailRental.feedback_sent_at && (
                      <div className="text-gravida-light-sage">
                        Mail verstuurd: {new Date(detailRental.feedback_sent_at).toLocaleString('nl-NL')}
                      </div>
                    )}
                    {detailRental.feedback_submitted_at ? (
                      <>
                        <div className="text-green-700 font-medium">
                          Klant heeft ingevuld: {new Date(detailRental.feedback_submitted_at).toLocaleString('nl-NL')}
                        </div>
                        {detailRental.scanner_issues && (
                          <div>
                            <span className="text-gravida-light-sage">Bijzonderheden tijdens gebruik:</span>
                            <p className="italic text-gravida-green whitespace-pre-wrap mt-0.5">{detailRental.scanner_issues}</p>
                          </div>
                        )}
                        {detailRental.deposit_choice && (
                          <div>
                            <span className="text-gravida-light-sage">Borg-keuze:</span>{' '}
                            <span className="text-gravida-green font-medium">
                              {detailRental.deposit_choice === 'order_credit' && 'Volledig verrekenen met beeldje (€200 korting)'}
                              {detailRental.deposit_choice === 'giftcard' && 'Cadeaubon €100 + €100 borg retour'}
                            </span>
                          </div>
                        )}
                        {detailRental.giftcard_id && (
                          <div className="text-amber-700">
                            Auto-cadeaubon (draft) aangemaakt — id #{detailRental.giftcard_id}, nog activeren in cadeaubonnen-overzicht
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-gravida-light-sage italic">Wacht op klant...</div>
                    )}
                  </div>
                </div>
              )}

              <ScanConsentSection diyRentalId={detailRental.id} />

              <div>
                <label className="label">Status wijzigen</label>
                <div className="flex gap-2 flex-wrap">
                  {RENTAL_STATUSES.filter(s => s !== 'alle').map(s => (
                    <button key={s} onClick={() => updateRentalStatus(detailRental.id, s)}
                      disabled={detailRental.status === s || updatingRental === detailRental.id}
                      className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border ${
                        detailRental.status === s ? STATUS_COLORS[s] + ' border-transparent' : 'bg-white border-gravida-cream text-gravida-light-sage hover:border-gravida-sage hover:text-gravida-sage'
                      } disabled:cursor-default`}
                    >{s.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
              {/* Verzonden mail knop — toon alleen als nog niet verzonden */}
              {detailRental.status !== 'verzonden' && detailRental.status !== 'geannuleerd' && (
                <button
                  onClick={sendShippedEmail}
                  disabled={updatingRental === detailRental.id}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200 transition-colors disabled:opacity-50"
                  title="Stuurt klant een mail dat de scanner vandaag is verstuurd, en zet status op 'verzonden'"
                >
                  {updatingRental === detailRental.id ? 'Bezig...' : '📦 Markeer verzonden + stuur mail'}
                </button>
              )}

              {/* Feedback / borg-keuze mail knop (handmatig, los van de auto-cron) */}
              {detailRental.status !== 'geannuleerd' && (
                <button
                  onClick={sendFeedbackEmail}
                  disabled={updatingRental === detailRental.id}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-purple-100 text-purple-700 border border-purple-200 hover:bg-purple-200 transition-colors disabled:opacity-50"
                  title="Stuurt klant het formulier met scanner-feedback + borg-keuze (terugstorten / verrekenen / cadeaubon)"
                >
                  {updatingRental === detailRental.id ? 'Bezig...' : 'Stuur feedback + borg-keuze mail'}
                </button>
              )}

              {/* Retour ontvangen mail knop */}
              {detailRental.status !== 'geannuleerd' && !detailRental.return_received_at && (
                <button
                  onClick={openReturnModal}
                  disabled={updatingRental === detailRental.id}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200 transition-colors disabled:opacity-50"
                  title="Markeer scanner als retour ontvangen en stuur klant een bevestigingsmail"
                >
                  Scanner retour ontvangen + stuur mail
                </button>
              )}
              {detailRental.return_received_at && (
                <button
                  onClick={openReturnModal}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors"
                  title="Defect-opmerking aanpassen of opnieuw mailen"
                >
                  Retour ontvangen: {new Date(detailRental.return_received_at).toLocaleDateString('nl-NL')} - bewerken
                </button>
              )}
              {detailRental.scanner_defect && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-red-800 mb-1">Defect / opmerking bij retour:</p>
                  <p className="text-red-900 whitespace-pre-wrap">{detailRental.scanner_defect}</p>
                </div>
              )}
              <div>
                <label className="label">Borg</label>
                <div className="flex gap-2">
                  <button onClick={() => updateDeposit(detailRental.id, 'ingehouden')}
                    disabled={detailRental.deposit_status === 'ingehouden'}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      detailRental.deposit_status === 'ingehouden' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white border-gravida-cream text-gravida-light-sage hover:border-gravida-sage'
                    } disabled:cursor-default`}
                  >Ingehouden</button>
                  <button onClick={() => updateDeposit(detailRental.id, 'teruggestort')}
                    disabled={detailRental.deposit_status === 'teruggestort'}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      detailRental.deposit_status === 'teruggestort' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white border-gravida-cream text-gravida-light-sage hover:border-gravida-sage'
                    } disabled:cursor-default`}
                  >Teruggestort</button>
                </div>
              </div>
              {detailRental.status !== 'geannuleerd' && (
                <button
                  onClick={async () => {
                    if (!confirm(`Reservering van ${detailRental.first_name} ${detailRental.last_name} annuleren?\n\nDe reservering blijft zichtbaar maar krijgt status 'geannuleerd'.`)) return
                    await updateRentalStatus(detailRental.id, 'geannuleerd')
                  }}
                  className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  × Reservering annuleren
                </button>
              )}
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/diy-rentals')
                    if (res.ok) setAvailableWeeksForEdit((await res.json()).weeks ?? [])
                  } catch { /* ignore */ }
                  setEditForm({
                    first_name: detailRental.first_name,
                    last_name: detailRental.last_name,
                    email: detailRental.email,
                    phone: detailRental.phone,
                    address: detailRental.address,
                    city: detailRental.city,
                    zip_code: detailRental.zip_code,
                    rental_week: detailRental.rental_week,
                    notes: detailRental.notes ?? '',
                    internal_notes: detailRental.internal_notes ?? '',
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
                <div className="col-span-2">
                  <label className="label">Week (do t/m zo)</label>
                  <select className="input-field" value={editForm.rental_week ?? ''} onChange={e => setEditForm(f => ({ ...f, rental_week: e.target.value }))}>
                    <option value={detailRental.rental_week}>Huidig: {formatWeek(detailRental.rental_week)}</option>
                    {availableWeeksForEdit.filter(w => w !== detailRental.rental_week).map(w => (
                      <option key={w} value={w}>{formatWeek(w)}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Opmerkingen klant</label>
                  <textarea className="input-field" rows={2} value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="label">Interne opmerkingen</label>
                  <textarea className="input-field" rows={3} value={editForm.internal_notes ?? ''} onChange={e => setEditForm(f => ({ ...f, internal_notes: e.target.value }))} />
                </div>
              </div>

              {editError && <p className="text-red-600 text-sm">{editError}</p>}

              <div className="flex gap-2">
                <button onClick={() => { setEditMode(false); setEditError('') }} className="flex-1 py-2 rounded-lg text-sm font-medium border border-gravida-cream text-gravida-light-sage hover:border-gravida-sage transition-colors">Annuleren</button>
                <button
                  onClick={() => saveDiyEdit(false)}
                  disabled={editSaving}
                  className="flex-1 btn-secondary"
                >
                  {editSaving ? 'Opslaan...' : '💾 Opslaan'}
                </button>
              </div>

              <button
                onClick={() => saveDiyEdit(true)}
                disabled={editSaving}
                className="w-full mt-2 py-2 rounded-lg text-sm font-medium bg-gravida-sage text-white hover:bg-gravida-green transition-colors disabled:opacity-50"
                type="button"
                title="Slaat eerst op en stuurt daarna direct de update-mail naar klant en medewerker met de net opgeslagen gegevens"
              >
                {editSaving ? 'Bezig...' : '💾 Opslaan + 📧 stuur update-mail'}
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* New rental modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <h2 className="text-lg font-bold text-gravida-sage">Nieuwe reservering</h2>
              <button onClick={() => setShowNewModal(false)} className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {newSuccess ? (
                <div className="text-center py-6">
                  <p className="text-green-700 font-semibold text-lg mb-2">{newSuccess}</p>
                  <button onClick={() => setShowNewModal(false)} className="btn-primary mt-4">Sluiten</button>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label mb-0">Week (do t/m zo) *</label>
                      <button type="button"
                        onClick={() => setNewCustomDate(c => !c)}
                        className="text-[11px] text-gravida-sage hover:text-gravida-green underline">
                        {newCustomDate ? '← terug naar weekkeuze' : '✏️ vrije datum invoeren'}
                      </button>
                    </div>
                    {!newCustomDate ? (
                      <select className="input-field" value={newForm.rental_week} onChange={e => setNewForm(f => ({ ...f, rental_week: e.target.value }))}>
                        <option value="">Selecteer week...</option>
                        {availableWeeks.map(w => <option key={w} value={w}>{formatWeek(w)}</option>)}
                      </select>
                    ) : (
                      <>
                        <input type="date" className="input-field"
                          value={newForm.rental_week}
                          onChange={e => setNewForm(f => ({ ...f, rental_week: e.target.value }))} />
                        <p className="text-[10px] text-gravida-light-sage mt-1">
                          Kies eender welke datum (verleden of toekomst). De rest van de planning past zich automatisch aan.
                        </p>
                      </>
                    )}
                  </div>
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
                    <div className="col-span-2">
                      <label className="label">Opmerkingen</label>
                      <textarea className="input-field" rows={2} value={newForm.notes} onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  {newError && <p className="text-red-600 text-sm">{newError}</p>}
                  <button onClick={handleNewRental} disabled={newLoading} className="btn-primary w-full">
                    {newLoading ? 'Bezig...' : 'Reservering aanmaken'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Retour-ontvangen modal */}
      {returnModalOpen && detailRental && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <h2 className="text-lg font-bold text-gravida-sage">Scanner retour ontvangen</h2>
              <button onClick={() => setReturnModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center text-gravida-light-sage">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gravida-sage">
                Retour van <strong>{detailRental.first_name} {detailRental.last_name}</strong>.
                Laat onderstaand veld leeg als de scanner in goede orde is. Anders noteer wat er aan de hand was.
              </p>
              <div>
                <label className="label">Defect / opmerking (alleen team)</label>
                <textarea rows={3} className="input-field bg-red-50/40"
                  placeholder="Bijv. knop op zijkant los, krasje in lens..."
                  value={returnDefect}
                  onChange={e => setReturnDefect(e.target.value)} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                {returnDefect.trim()
                  ? 'Er is een defect ingevuld. De &quot;in goede orde&quot;-mail past dan misschien niet — kies wat je wilt doen.'
                  : 'Status wordt op &quot;retour&quot; gezet (tenzij al op uitzoeken/scans uitgezocht), en klant krijgt een nette bevestiging dat scanner is binnengekomen.'}
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => submitReturnReceived(true)}
                  disabled={updatingRental === detailRental.id}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                  {updatingRental === detailRental.id ? 'Bezig...' : 'Markeer retour + stuur klant mail'}
                </button>
                <button onClick={() => submitReturnReceived(false)}
                  disabled={updatingRental === detailRental.id}
                  className="w-full py-2 rounded-lg text-sm font-medium bg-white border border-gravida-cream hover:border-gravida-sage disabled:opacity-50">
                  Alleen opslaan, geen mail naar klant
                </button>
                <button onClick={() => setReturnModalOpen(false)}
                  className="w-full py-2 rounded-lg text-sm font-medium text-gravida-light-sage hover:text-gravida-sage">
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
