'use client'

import { useCallback, useEffect, useState } from 'react'
import StlManager from '@/app/admin/components/StlManager'

interface OverviewRow {
  kind: 'rental' | 'booking'
  id: number
  first_name: string
  last_name: string
  email: string
  customer_number: string | null
  status: string
  reference_date: string
  file_count: number
  count_1: number
  count_2: number
  total_bytes: number
  chosen_label: number | null
  consent_submitted_at: string | null
}

function formatSize(bytes: number): string {
  if (!bytes) return '0'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    geboekt: 'bg-blue-100 text-blue-700',
    bevestigd: 'bg-green-100 text-green-700',
    verzonden: 'bg-purple-100 text-purple-700',
    retour: 'bg-amber-100 text-amber-700',
    uitzoeken: 'bg-pink-100 text-pink-700',
    'scans uitgezocht': 'bg-green-100 text-green-700',
    afgerond: 'bg-gray-100 text-gray-600',
    geannuleerd: 'bg-red-100 text-red-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export default function ScanArchiefPage() {
  const [rows, setRows] = useState<OverviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [includeEmpty, setIncludeEmpty] = useState(false)
  const [kindFilter, setKindFilter] = useState<'all' | 'rental' | 'booking'>('all')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/diy-scan-files/overview?q=${encodeURIComponent(q)}&include_empty=${includeEmpty ? 1 : 0}&kind=${kindFilter}`, { credentials: 'include' })
      const d = await r.json()
      setRows(d.rentals ?? [])
    } finally {
      setLoading(false)
    }
  }, [q, includeEmpty, kindFilter])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [load])

  const totalFiles = rows.reduce((s, r) => s + r.file_count, 0)
  const totalBytes = rows.reduce((s, r) => s + Number(r.total_bytes || 0), 0)

  const keyOf = (r: OverviewRow) => `${r.kind}-${r.id}`

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Scan archief</h1>
          <p className="text-gravida-sage mt-1 text-sm">
            Alle DIY verhuringen en aan-huis afspraken met geüploade 3D scan bestanden. Klik een rij open om STLs te bekijken, 3D te previewen, te uploaden of te verwijderen.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gravida-light-sage">Totaal opgeslagen</p>
          <p className="text-sm font-semibold text-gravida-green">{totalFiles} bestanden · {formatSize(totalBytes)}</p>
        </div>
      </div>

      <div className="card mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Zoek op naam, klantnr of e-mail..."
          className="input-field flex-1 min-w-[220px]"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <div className="flex gap-1">
          {([
            ['all', 'Alles'],
            ['booking', 'Aan-huis / studio'],
            ['rental', 'DIY verhuur'],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setKindFilter(key)}
              className={`text-xs px-3 py-1.5 rounded-full ${kindFilter === key
                ? 'bg-gravida-sage text-white'
                : 'bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage'}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gravida-sage cursor-pointer">
          <input type="checkbox" checked={includeEmpty} onChange={e => setIncludeEmpty(e.target.checked)} />
          Toon ook klanten zonder bestanden
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gravida-light-sage italic">Geen klanten gevonden.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const k = keyOf(r)
            const isOpen = openKey === k
            return (
              <div key={k} className="card p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenKey(isOpen ? null : k)}
                  className="w-full text-left p-4 hover:bg-gravida-off-white transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${r.kind === 'rental' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.kind === 'rental' ? 'DIY' : 'Aan-huis'}
                        </span>
                        <h3 className="font-semibold text-gravida-green">{r.first_name} {r.last_name}</h3>
                        {r.customer_number && (
                          <span className="font-mono text-xs text-gravida-sage">{r.customer_number}</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>{r.status}</span>
                        {r.chosen_label && (
                          <span className="text-[10px] bg-gravida-green text-white px-2 py-0.5 rounded-full">
                            Klantkeuze: Scan {r.chosen_label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gravida-sage mt-1">
                        {r.kind === 'rental' ? 'Verhuurweek' : 'Afspraakdatum'}{' '}
                        {new Date(r.reference_date).toLocaleDateString('nl-NL')} · {r.email}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gravida-sage shrink-0">
                      <p>
                        <span className="text-gravida-green font-semibold">{r.file_count}</span> bestand{r.file_count === 1 ? '' : 'en'}
                        <span className="text-gravida-light-sage"> · {formatSize(Number(r.total_bytes))}</span>
                      </p>
                      <p className="text-[11px] text-gravida-light-sage">
                        Scan 1: {r.count_1} · Scan 2: {r.count_2}
                      </p>
                      <p className="text-[11px] mt-1">{isOpen ? '▲ inklappen' : '▼ openen'}</p>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gravida-cream p-4 bg-gravida-off-white/40">
                    {r.kind === 'rental'
                      ? <StlManager rentalId={r.id} customerNumber={r.customer_number} />
                      : <StlManager bookingId={r.id} customerNumber={r.customer_number} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
