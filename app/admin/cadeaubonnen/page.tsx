'use client'

import { useEffect, useState, useCallback } from 'react'

interface GiftCard {
  id: number
  code: string
  type: string
  value_euros: number
  status: string
  purchaser_name: string
  purchaser_email: string
  recipient_name: string
  recipient_email: string
  personal_message: string | null
  mollie_payment_id: string | null
  redeemed_at: string | null
  redeemed_by_booking_id: number | null
  expires_at: string
  created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  digitaal: 'Digitale cadeaubon',
  gedrukt: 'Gedrukte cadeaubon',
  usb_box: 'USB Cadeaubox',
}

const STATUS_LABELS: Record<string, string> = {
  actief: 'Actief',
  ingewisseld: 'Ingewisseld',
  wacht_op_betaling: 'Wacht op betaling',
  geannuleerd: 'Geannuleerd',
  verlopen: 'Verlopen',
}

const STATUS_COLORS: Record<string, string> = {
  actief: 'bg-green-100 text-green-700',
  ingewisseld: 'bg-blue-100 text-blue-700',
  wacht_op_betaling: 'bg-yellow-100 text-yellow-700',
  geannuleerd: 'bg-red-100 text-red-700',
  verlopen: 'bg-gray-100 text-gray-500',
}

const FILTER_TABS = [
  { key: 'alle', label: 'Alle' },
  { key: 'actief', label: 'Actief' },
  { key: 'ingewisseld', label: 'Ingewisseld' },
  { key: 'wacht_op_betaling', label: 'Wacht op betaling' },
  { key: 'geannuleerd', label: 'Geannuleerd' },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY_NEW_FORM = {
  type: 'digitaal',
  value_euros: '',
  purchaser_name: '',
  purchaser_email: '',
  recipient_name: '',
  recipient_email: '',
  personal_message: '',
}

export default function CadeaubonnenPage() {
  const [cards, setCards] = useState<GiftCard[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState('alle')
  const [detailCard, setDetailCard] = useState<GiftCard | null>(null)
  const [updating, setUpdating] = useState<number | null>(null)

  // New card modal
  const [showNewModal, setShowNewModal] = useState(false)
  const [newForm, setNewForm] = useState({ ...EMPTY_NEW_FORM })
  const [newError, setNewError] = useState('')
  const [newSuccess, setNewSuccess] = useState('')
  const [newLoading, setNewLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/gift-cards', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setCards(data.giftCards ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = filterTab === 'alle'
    ? cards
    : cards.filter(c => c.status === filterTab)

  // Stats
  const actief = cards.filter(c => c.status === 'actief')
  const ingewisseld = cards.filter(c => c.status === 'ingewisseld')
  const wachtOpBetaling = cards.filter(c => c.status === 'wacht_op_betaling')
  const totalActief = actief.reduce((s, c) => s + c.value_euros, 0)

  const doAction = async (id: number, action: 'redeem' | 'cancel' | 'activate') => {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/gift-cards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCards(prev => prev.map(c => c.id === id ? updated : c))
        if (detailCard?.id === id) setDetailCard(updated)
      }
    } finally {
      setUpdating(null)
    }
  }

  const handleNewCard = async () => {
    if (!newForm.type || !newForm.value_euros || !newForm.purchaser_name || !newForm.purchaser_email || !newForm.recipient_name || !newForm.recipient_email) {
      setNewError('Vul alle verplichte velden in.')
      return
    }
    const value = parseFloat(newForm.value_euros)
    if (isNaN(value) || value < 1) {
      setNewError('Voer een geldig bedrag in.')
      return
    }
    setNewLoading(true)
    setNewError('')
    try {
      const res = await fetch('/api/admin/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...newForm,
          value_euros: value,
          personal_message: newForm.personal_message || undefined,
        }),
      })
      if (res.ok) {
        setNewSuccess('Cadeaubon aangemaakt en e-mails verstuurd!')
        loadData()
      } else {
        const data = await res.json().catch(() => ({}))
        setNewError(data.error ?? 'Aanmaken mislukt.')
      }
    } catch {
      setNewError('Verbindingsfout.')
    } finally {
      setNewLoading(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Cadeaubonnen</h1>
          <p className="text-gravida-sage mt-1">Beheer cadeaubonnen en bestellingen</p>
        </div>
        <button
          onClick={() => { setShowNewModal(true); setNewForm({ ...EMPTY_NEW_FORM }); setNewError(''); setNewSuccess('') }}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <span>+</span> Nieuwe cadeaubon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <div className="card">
          <p className="text-xs text-gravida-light-sage uppercase tracking-wide font-medium mb-1">Actief</p>
          <p className="text-2xl font-bold text-gravida-green">{actief.length}</p>
          <p className="text-sm text-gravida-sage">&euro;{totalActief.toFixed(2)} waarde</p>
        </div>
        <div className="card">
          <p className="text-xs text-gravida-light-sage uppercase tracking-wide font-medium mb-1">Ingewisseld</p>
          <p className="text-2xl font-bold text-blue-600">{ingewisseld.length}</p>
        </div>
        <div className="card col-span-2 sm:col-span-1">
          <p className="text-xs text-gravida-light-sage uppercase tracking-wide font-medium mb-1">Wacht op betaling</p>
          <p className="text-2xl font-bold text-yellow-600">{wachtOpBetaling.length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterTab === tab.key
                ? 'bg-gravida-green text-white'
                : 'bg-white text-gravida-sage hover:bg-gravida-cream border border-gravida-cream'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gravida-sage self-center">
          {loading ? 'Laden...' : `${filtered.length} resultaat${filtered.length !== 1 ? 'en' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">
            <div className="w-6 h-6 border-2 border-gravida-sage border-t-transparent rounded-full animate-spin mr-2" />
            Laden...
          </div>
        ) : filtered.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gravida-light-sage">
            Geen cadeaubonnen gevonden.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden p-4 space-y-3">
              {filtered.map(c => (
                <div
                  key={c.id}
                  className="border border-gravida-cream rounded-xl p-4 space-y-2 cursor-pointer hover:border-gravida-sage transition-colors"
                  onClick={() => setDetailCard(c)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-gravida-green">{c.code}</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </div>
                  <div className="text-sm text-gravida-sage">{TYPE_LABELS[c.type] ?? c.type} &middot; <strong>&euro;{c.value_euros}</strong></div>
                  <div className="text-xs text-gravida-light-sage">
                    Van: {c.purchaser_name} &rarr; {c.recipient_name}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gravida-cream/50">
                  <tr>
                    {['Code', 'Type', 'Waarde', 'Status', 'Koper', 'Ontvanger', 'Aangemaakt', 'Verloopt', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium text-gravida-light-sage whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gravida-cream">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-gravida-off-white transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono font-semibold text-gravida-green">{c.code}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gravida-sage">
                        {TYPE_LABELS[c.type] ?? c.type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold">
                        &euro;{c.value_euros}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{c.purchaser_name}</div>
                        <div className="text-xs text-gravida-light-sage">{c.purchaser_email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium">{c.recipient_name}</div>
                        <div className="text-xs text-gravida-light-sage">{c.recipient_email}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gravida-sage text-xs">
                        {formatDate(c.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gravida-sage text-xs">
                        {formatDate(c.expires_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetailCard(c)}
                          className="text-gravida-sage hover:text-gravida-green text-xs underline"
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

      {/* Detail modal */}
      {detailCard && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <div>
                <p className="text-xs text-gravida-light-sage uppercase tracking-wide font-medium mb-0.5">Cadeauboncode</p>
                <p className="text-2xl font-bold font-mono text-gravida-green tracking-widest">{detailCard.code}</p>
              </div>
              <button
                onClick={() => setDetailCard(null)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage"
              >
                &#x2715;
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Details */}
              <div>
                <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Cadeaubon</p>
                <div className="space-y-1">
                  <Row label="Type" value={TYPE_LABELS[detailCard.type] ?? detailCard.type} />
                  <Row label="Waarde" value={`\u20AC${detailCard.value_euros}`} />
                  <Row label="Status" value={STATUS_LABELS[detailCard.status] ?? detailCard.status} />
                  <Row label="Aangemaakt" value={formatDate(detailCard.created_at)} />
                  <Row label="Verloopt" value={formatDate(detailCard.expires_at)} />
                  {detailCard.redeemed_at && <Row label="Ingewisseld op" value={formatDate(detailCard.redeemed_at)} />}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Koper</p>
                <div className="space-y-1">
                  <Row label="Naam" value={detailCard.purchaser_name} />
                  <Row label="E-mail" value={detailCard.purchaser_email} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Ontvanger</p>
                <div className="space-y-1">
                  <Row label="Naam" value={detailCard.recipient_name} />
                  <Row label="E-mail" value={detailCard.recipient_email} />
                </div>
              </div>
              {detailCard.personal_message && (
                <div>
                  <p className="text-xs font-medium text-gravida-light-sage uppercase tracking-wide mb-2">Persoonlijk bericht</p>
                  <p className="text-sm text-gravida-sage italic">{detailCard.personal_message}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                {detailCard.status === 'actief' && (
                  <>
                    <button
                      onClick={() => doAction(detailCard.id, 'redeem')}
                      disabled={updating === detailCard.id}
                      className="w-full py-2 rounded-lg text-sm font-medium border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      Markeer als ingewisseld
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Cadeaubon ${detailCard.code} annuleren?`)) return
                        await doAction(detailCard.id, 'cancel')
                      }}
                      disabled={updating === detailCard.id}
                      className="w-full py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      Annuleren
                    </button>
                  </>
                )}
                {detailCard.status === 'wacht_op_betaling' && (
                  <button
                    onClick={() => doAction(detailCard.id, 'activate')}
                    disabled={updating === detailCard.id}
                    className="w-full py-2 rounded-lg text-sm font-medium border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                  >
                    Handmatig activeren
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New card modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <h2 className="text-lg font-bold text-gravida-sage">Nieuwe cadeaubon</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage"
              >
                &#x2715;
              </button>
            </div>
            <div className="p-6 space-y-4">
              {newSuccess ? (
                <div className="text-center py-6">
                  <p className="text-green-700 font-semibold text-lg mb-2">{newSuccess}</p>
                  <button onClick={() => setShowNewModal(false)} className="btn-primary mt-4">Sluiten</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Type *</label>
                      <select
                        className="input-field"
                        value={newForm.type}
                        onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))}
                      >
                        <option value="digitaal">Digitale cadeaubon</option>
                        <option value="gedrukt">Gedrukte cadeaubon</option>
                        <option value="usb_box">USB Cadeaubox</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Bedrag (&euro;) *</label>
                      <input
                        type="number"
                        min="1"
                        className="input-field"
                        value={newForm.value_euros}
                        onChange={e => setNewForm(f => ({ ...f, value_euros: e.target.value }))}
                        placeholder="bv. 50"
                      />
                    </div>
                    <div>
                      <label className="label">Naam koper *</label>
                      <input
                        className="input-field"
                        value={newForm.purchaser_name}
                        onChange={e => setNewForm(f => ({ ...f, purchaser_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">E-mail koper *</label>
                      <input
                        type="email"
                        className="input-field"
                        value={newForm.purchaser_email}
                        onChange={e => setNewForm(f => ({ ...f, purchaser_email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Naam ontvanger *</label>
                      <input
                        className="input-field"
                        value={newForm.recipient_name}
                        onChange={e => setNewForm(f => ({ ...f, recipient_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">E-mail ontvanger *</label>
                      <input
                        type="email"
                        className="input-field"
                        value={newForm.recipient_email}
                        onChange={e => setNewForm(f => ({ ...f, recipient_email: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Persoonlijk bericht (optioneel)</label>
                      <textarea
                        className="input-field"
                        rows={3}
                        maxLength={300}
                        value={newForm.personal_message}
                        onChange={e => setNewForm(f => ({ ...f, personal_message: e.target.value }))}
                      />
                    </div>
                  </div>
                  {newError && <p className="text-red-600 text-sm">{newError}</p>}
                  <button
                    onClick={handleNewCard}
                    disabled={newLoading}
                    className="btn-primary w-full"
                  >
                    {newLoading ? 'Aanmaken...' : 'Cadeaubon aanmaken'}
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
