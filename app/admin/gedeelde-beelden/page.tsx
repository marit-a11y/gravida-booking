'use client'

import { useEffect, useState } from 'react'

interface Submission {
  id: string
  naam: string
  email: string
  bericht: string
  fotoUrl: string | null
  status: 'pending' | 'approved' | 'rejected'
  timestamp: string
}

const STATUS_LABELS: Record<Submission['status'], { label: string; cls: string }> = {
  pending: { label: 'Wachtend', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  approved: { label: 'Goedgekeurd', cls: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Afgewezen', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

export default function GedeeldeBeelden() {
  const [items, setItems] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [updating, setUpdating] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/admin/site-submissions', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) {
        setError(d?.error ?? 'Laden mislukt')
        setItems([])
      } else {
        setItems(d.submissions ?? [])
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setUpdating(id)
    try {
      const r = await fetch('/api/admin/site-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (r.ok) {
        setItems(prev => prev.map(s => s.id === id ? { ...s, status } : s))
      } else {
        const d = await r.json().catch(() => ({}))
        alert('Fout: ' + (d?.error ?? 'wijziging mislukt'))
      }
    } finally { setUpdating(null) }
  }

  const filtered = filter === 'all' ? items : items.filter(s => s.status === filter)
  const counts = {
    pending: items.filter(s => s.status === 'pending').length,
    approved: items.filter(s => s.status === 'approved').length,
    rejected: items.filter(s => s.status === 'rejected').length,
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Gedeelde beelden</h1>
          <p className="text-gravida-sage mt-1 text-sm">Inzendingen van bezoekers via &lsquo;Deel jouw beeld&rsquo; op gravida.nl. Goedgekeurd = zichtbaar onder Lieve Woorden.</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          {loading ? 'Vernieuwen...' : '↻ Vernieuwen'}
        </button>
      </div>

      {error && (
        <div className="card mb-6 bg-red-50 border-red-200">
          <p className="text-sm text-red-700">
            <strong>Verbinding met site mislukt:</strong> {error}
          </p>
          <p className="text-xs text-red-600 mt-2">
            Check of <code>GRAVIDA_SITE_SECRET</code> in Vercel env vars staat (gelijk aan <code>ADMIN_SECRET</code> op gravida-new).
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="card mb-4 flex gap-1.5 flex-wrap">
        {[
          { key: 'pending', label: `Wachtend (${counts.pending})` },
          { key: 'approved', label: `Goedgekeurd (${counts.approved})` },
          { key: 'rejected', label: `Afgewezen (${counts.rejected})` },
          { key: 'all', label: `Alles (${items.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilter(t.key as typeof filter)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${filter === t.key ? 'bg-gravida-sage text-white' : 'bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gravida-light-sage italic">Geen inzendingen in deze categorie.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const status = STATUS_LABELS[s.status]
            return (
              <div key={s.id} className={`card border-l-4 ${
                s.status === 'pending' ? 'border-orange-400' :
                s.status === 'approved' ? 'border-green-400' : 'border-gray-300'
              }`}>
                {s.fotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.fotoUrl} alt={s.naam} className="w-full h-48 object-cover rounded-lg mb-3" />
                )}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gravida-green truncate">{s.naam}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.cls} whitespace-nowrap`}>
                    {status.label}
                  </span>
                </div>
                {s.bericht && (
                  <p className="text-sm text-gravida-sage italic mb-2 line-clamp-4">&ldquo;{s.bericht}&rdquo;</p>
                )}
                <p className="text-[11px] text-gravida-light-sage mb-3">
                  {new Date(s.timestamp).toLocaleString('nl-NL')} &middot; {s.email}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {s.status === 'pending' && (
                    <>
                      <button onClick={() => updateStatus(s.id, 'approved')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50">
                        ✓ Toevoegen aan Lieve Woorden
                      </button>
                      <button onClick={() => updateStatus(s.id, 'rejected')} disabled={updating === s.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream hover:border-gravida-sage text-gravida-sage disabled:opacity-50">
                        ✕ Afwijzen
                      </button>
                    </>
                  )}
                  {s.status === 'approved' && (
                    <button onClick={() => updateStatus(s.id, 'rejected')} disabled={updating === s.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                      Verwijderen uit Lieve Woorden
                    </button>
                  )}
                  {s.status === 'rejected' && (
                    <button onClick={() => updateStatus(s.id, 'approved')} disabled={updating === s.id}
                      className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50">
                      Alsnog toevoegen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
