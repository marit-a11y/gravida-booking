'use client'

import { useEffect, useState, useCallback } from 'react'

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

  const openNewModal = async () => {
    setShowNewModal(true)
    setNewForm({ rental_week: '', first_name: '', last_name: '', email: '', phone: '', address: '', city: '', zip_code: '', notes: '' })
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
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label className="label">Status</label>
            <select className="input-field" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              {RENTAL_STATUSES.map(s => (
                <option key={s} value={s}>{s === 'alle' ? 'Alle statussen' : s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-gravida-sage sm:mt-5">
            {loading ? 'Laden...' : `${rentals.length} reservering${rentals.length !== 1 ? 'en' : ''}`}
          </p>
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
        ) : (
          <>
          {/* Mobile cards */}
          <div className="sm:hidden p-4 space-y-3">
            {rentals.map(r => (
              <div key={r.id} className="border border-gravida-cream rounded-xl p-4 space-y-2" onClick={() => setDetailRental(r)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.first_name} {r.last_name}</p>
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
                {rentals.map(r => (
                  <tr key={r.id} className="hover:bg-gravida-off-white transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium">{r.first_name} {r.last_name}</div>
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
        )}
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
                    <label className="label">Week (do t/m zo) *</label>
                    <select className="input-field" value={newForm.rental_week} onChange={e => setNewForm(f => ({ ...f, rental_week: e.target.value }))}>
                      <option value="">Selecteer week...</option>
                      {availableWeeks.map(w => <option key={w} value={w}>{formatWeek(w)}</option>)}
                    </select>
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
