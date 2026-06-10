'use client'

// /admin/ai-beoordeling — Atelier AI scans inbox
//
// Lists incoming scans from the smartphone app. Click one to open the review
// pane: see all uploaded photos, pick which to attach to the approval email,
// add an optional Atelier note, send. Approving stamps reviewed_at and flips
// status to 'approved'.

import { useEffect, useState } from 'react'

type AiScan = {
  id: number
  session_id: string
  client_first_name: string | null
  client_last_name:  string | null
  client_email:      string | null
  client_phone:      string | null
  pregnancy_weeks:   number | null
  customer_number:   string | null
  status: 'in_progress' | 'received' | 'reviewing' | 'approved' | 'rejected'
  app_version:       string | null
  device_label:      string | null
  created_at:        string
  received_at:       string | null
  reviewed_at:       string | null
  sent_email_at:     string | null
  atelier_notes:     string | null
  photo_count:       number
  // Rodin auto-preview state. Null if the customer's scan hasn't been
  // queued for Rodin yet (RODIN_API_KEY missing, or pre-Rodin scans from
  // before this feature shipped).
  preview_status:       'queued' | 'generating' | 'ready' | 'failed' | null
  preview_glb_url:      string | null
  preview_stl_url:      string | null
  preview_completed_at: string | null
  preview_error:        string | null
}

type Photo = {
  id: number
  angle: 'front' | 'right' | 'back' | 'left' | 'detail'
  order_idx: number
  blob_url: string
  mime: string
  bytes: number
  note: string | null
  created_at: string
}

const STATUS_BADGES: Record<string, string> = {
  in_progress: 'bg-gray-100 text-gray-600',
  received:    'bg-pink-100 text-pink-700',
  reviewing:   'bg-amber-100 text-amber-700',
  approved:    'bg-green-100 text-green-700',
  rejected:    'bg-red-100 text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'Uploaden',
  received:    'Net binnen',
  reviewing:   'In behandeling',
  approved:    'Goedgekeurd',
  rejected:    'Afgewezen',
}

function formatDateTime(s: string | null): string {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
       + ' ' + d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function fullName(s: AiScan): string {
  return [s.client_first_name, s.client_last_name].filter(Boolean).join(' ').trim() || '(geen naam)'
}

export default function AiBeoordelingPage() {
  const [scans,     setScans]     = useState<AiScan[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail,    setDetail]    = useState<{ scan: AiScan, photos: Photo[] } | null>(null)
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set())
  const [extraWensen, setExtraWensen] = useState('')
  const [customerNumber, setCustomerNumber] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // ── load list ──
  const fetchList = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/ai-scans', { credentials: 'include' })
      const d = await r.json()
      setScans(d.scans ?? [])
    } finally { setLoading(false) }
  }
  useEffect(() => { fetchList() }, [])

  // ── select + load detail ──
  const selectScan = async (id: number) => {
    if (selectedId === id) { setSelectedId(null); setDetail(null); return }
    setSelectedId(id); setDetail(null); setErr(null); setSent(null)
    setSelectedPhotoIds(new Set()); setExtraWensen('')
    const r = await fetch(`/api/admin/ai-scans/${id}`, { credentials: 'include' })
    if (!r.ok) { setErr('Kon scan niet laden'); return }
    const d = await r.json()
    setDetail({ scan: d.scan, photos: d.photos })
    setCustomerNumber(d.scan.customer_number ?? '')
    // Pre-select the 4 main angle photos by default — the details are opt-in.
    const main = d.photos
      .filter((p: Photo) => p.angle !== 'detail')
      .map((p: Photo) => p.id)
    setSelectedPhotoIds(new Set(main))
    // First open flips received → reviewing so the badge clears.
    if (d.scan.status === 'received') {
      await fetch(`/api/admin/ai-scans/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reviewing' }),
      })
      fetchList()
    }
  }

  const togglePhoto = (id: number) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const sendApprovalEmail = async () => {
    if (!detail) return
    setErr(null); setSending(true)
    try {
      // Save customer_number first if it changed.
      if ((customerNumber || null) !== (detail.scan.customer_number || null)) {
        await fetch(`/api/admin/ai-scans/${detail.scan.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_number: customerNumber }),
        })
      }
      const r = await fetch(`/api/admin/ai-scans/${detail.scan.id}/send-email`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extra_wensen: extraWensen.trim() || null,
          selected_photo_ids: Array.from(selectedPhotoIds),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Mail mislukt')
      setSent(`Mail verstuurd naar ${detail.scan.client_email} met ${d.photos ?? 0} foto's.`)
      fetchList()
    } catch (e: any) {
      setErr(e?.message ?? 'Mail mislukt')
    } finally { setSending(false) }
  }

  const reject = async () => {
    if (!detail) return
    if (!confirm('Markeer als afgewezen? De klant krijgt geen mail; je moet zelf contact opnemen.')) return
    setSending(true)
    try {
      await fetch(`/api/admin/ai-scans/${detail.scan.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', atelier_notes: extraWensen.trim() || null }),
      })
      setSelectedId(null); setDetail(null); fetchList()
    } finally { setSending(false) }
  }

  // ── inbox queues ──
  const inbox    = scans.filter(s => s.status === 'received' || s.status === 'reviewing')
  const done     = scans.filter(s => s.status === 'approved')
  const dropped  = scans.filter(s => s.status === 'rejected')
  const drafts   = scans.filter(s => s.status === 'in_progress')

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Atelier AI scans</h1>
          <p className="text-sm text-gravida-sage mt-1">
            Binnenkomende scans uit de Gravida Scan app. Beoordeel, kies welke
            foto's mee in de mail gaan, en stuur de goedkeuring.
          </p>
        </div>
        {inbox.length > 0 && (
          <span className="shrink-0 bg-pink-100 text-pink-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            {inbox.length} te behandelen
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : (
        <>
          <Section title="Te behandelen" rows={inbox} selectedId={selectedId} onSelect={selectScan} empty="Geen openstaande scans." />
          {selectedId !== null && detail && (
            <DetailPanel
              detail={detail}
              selectedPhotoIds={selectedPhotoIds}
              togglePhoto={togglePhoto}
              extraWensen={extraWensen}
              setExtraWensen={setExtraWensen}
              customerNumber={customerNumber}
              setCustomerNumber={setCustomerNumber}
              sending={sending}
              sent={sent}
              err={err}
              onApprove={sendApprovalEmail}
              onReject={reject}
              onClose={() => { setSelectedId(null); setDetail(null) }}
            />
          )}
          <Section title="Goedgekeurd" rows={done}    selectedId={selectedId} onSelect={selectScan} empty="Nog niets goedgekeurd." />
          <Section title="Afgewezen"   rows={dropped} selectedId={selectedId} onSelect={selectScan} empty="Niets afgewezen." />
          {drafts.length > 0 && (
            <Section title="Onafgemaakt (klant uploadde niet alles)" rows={drafts} selectedId={selectedId} onSelect={selectScan} empty="" />
          )}
        </>
      )}
    </div>
  )
}

function Section({
  title, rows, selectedId, onSelect, empty,
}: {
  title: string,
  rows: AiScan[],
  selectedId: number | null,
  onSelect: (id: number) => void,
  empty: string,
}) {
  return (
    <div className="mb-6">
      <h2 className="section-title mb-3">{title} <span className="text-xs text-gravida-light-sage font-normal">({rows.length})</span></h2>
      {rows.length === 0 ? (
        empty ? <p className="text-sm text-gravida-light-sage italic mb-2">{empty}</p> : null
      ) : (
        <div className="space-y-2">
          {rows.map(s => {
            const isOpen = selectedId === s.id
            return (
              <button key={s.id} type="button"
                onClick={() => onSelect(s.id)}
                className={`w-full text-left card p-4 transition-colors ${isOpen ? 'ring-2 ring-gravida-green' : 'hover:border-gravida-sage'}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gravida-green">{fullName(s)}</span>
                      {s.customer_number && (
                        <span className="font-mono text-xs text-gravida-sage">{s.customer_number}</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGES[s.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </div>
                    <p className="text-xs text-gravida-sage mt-1">
                      {s.client_email ?? '(geen e-mail)'} · {s.photo_count} foto{s.photo_count === 1 ? '' : "'s"} · {formatDateTime(s.received_at ?? s.created_at)}
                    </p>
                  </div>
                  <span className="text-[11px] text-gravida-light-sage shrink-0">{isOpen ? '▲ inklappen' : '▼ openen'}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailPanel({
  detail, selectedPhotoIds, togglePhoto, extraWensen, setExtraWensen,
  customerNumber, setCustomerNumber, sending, sent, err, onApprove, onReject, onClose,
}: {
  detail: { scan: AiScan, photos: Photo[] },
  selectedPhotoIds: Set<number>,
  togglePhoto: (id: number) => void,
  extraWensen: string, setExtraWensen: (s: string) => void,
  customerNumber: string, setCustomerNumber: (s: string) => void,
  sending: boolean,
  sent: string | null,
  err: string | null,
  onApprove: () => void,
  onReject: () => void,
  onClose: () => void,
}) {
  const main = detail.photos.filter(p => p.angle !== 'detail')
  const details = detail.photos.filter(p => p.angle === 'detail')

  return (
    <div className="card mb-6 border-l-4 border-l-gravida-green">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs text-gravida-light-sage uppercase tracking-wide">Beoordelen</p>
          <p className="font-semibold text-gravida-green text-lg">{fullName(detail.scan)}</p>
          <p className="text-sm text-gravida-sage">
            {detail.scan.client_email} {detail.scan.client_phone ? `· ${detail.scan.client_phone}` : ''}
          </p>
          {(detail.scan.app_version || detail.scan.device_label) && (
            <p className="text-[11px] text-gravida-light-sage mt-1">
              {detail.scan.device_label ?? ''} {detail.scan.app_version ? `· app ${detail.scan.app_version}` : ''}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-xs text-gravida-sage hover:text-gravida-green">Sluit</button>
      </div>

      {/* Rodin auto-preview block: 3D viewer + STL download. Sits at the top of
          the detail panel so Laila sees the result at a glance. */}
      <PreviewBlock scan={detail.scan} />

      {/* Main 4 angles */}
      <p className="text-xs font-medium text-gravida-green uppercase tracking-wide mb-2">De vier hoeken</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {main.length === 0 && <p className="text-sm text-gravida-light-sage italic col-span-full">Geen hoofdhoeken geüpload.</p>}
        {main.map(p => (
          <PhotoTile key={p.id} p={p} selected={selectedPhotoIds.has(p.id)} onToggle={() => togglePhoto(p.id)} />
        ))}
      </div>

      {/* Detail close-ups */}
      {details.length > 0 && (
        <>
          <p className="text-xs font-medium text-gravida-green uppercase tracking-wide mb-2">Speciale details</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {details.map(p => (
              <PhotoTile key={p.id} p={p} selected={selectedPhotoIds.has(p.id)} onToggle={() => togglePhoto(p.id)} />
            ))}
          </div>
        </>
      )}

      {/* Customer number + notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-medium text-gravida-green block mb-1">Klantnummer (optioneel)</label>
          <input
            type="text"
            value={customerNumber}
            onChange={e => setCustomerNumber(e.target.value)}
            placeholder="bv. 1234"
            className="input-field w-full" />
        </div>
        <div>
          <label className="text-xs font-medium text-gravida-green block mb-1">Notitie bij de mail (optioneel)</label>
          <input
            type="text"
            value={extraWensen}
            onChange={e => setExtraWensen(e.target.value)}
            placeholder="Bijvoorbeeld: 'We hebben de schaduwen aan de zijkant iets verzacht.'"
            className="input-field w-full" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gravida-cream">
        <button
          type="button"
          onClick={onApprove}
          disabled={sending || selectedPhotoIds.size === 0 || !detail.scan.client_email}
          className="btn-primary disabled:opacity-50">
          {sending ? 'Versturen...' : `Stuur goedkeurings-mail (${selectedPhotoIds.size} foto's)`}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={sending}
          className="text-sm text-red-600 hover:text-red-700 px-3 py-2">
          Afwijzen, geen mail
        </button>
        {sent && <span className="text-sm text-green-700">{sent}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  )
}

// Rodin auto-preview: 3D viewer + STL download. Three states:
//   - generating: spinner + elapsed time
//   - ready: <model-viewer> with the GLB, plus a Download STL button
//   - failed / null: short reason message (or nothing if Rodin is disabled)
function PreviewBlock({ scan }: { scan: AiScan }) {
  // The <model-viewer> web-component is loaded lazily via CDN script the
  // first time this panel renders. It is registered globally so subsequent
  // mounts skip the load.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).__modelViewerLoaded) return
    const s = document.createElement('script')
    s.type   = 'module'
    s.src    = 'https://unpkg.com/@google/model-viewer@4.0.0/dist/model-viewer.min.js'
    s.async  = true
    document.head.appendChild(s)
    ;(window as any).__modelViewerLoaded = true
  }, [])

  if (!scan.preview_status) return null  // Rodin disabled or pre-feature scan

  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-gravida-green uppercase tracking-wide mb-2">
        Atelier AI preview
        {scan.preview_status === 'ready' && scan.preview_completed_at &&
          <span className="ml-2 text-gravida-light-sage font-normal normal-case tracking-normal">
            klaar {new Date(scan.preview_completed_at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>}
      </p>

      {scan.preview_status === 'queued' && (
        <div className="card p-4 bg-amber-50 border-l-4 border-l-amber-400">
          <p className="text-sm text-amber-900">In de wachtrij, de cron-job pikt 'm zo op.</p>
        </div>
      )}

      {scan.preview_status === 'generating' && (
        <div className="card p-4 bg-amber-50 border-l-4 border-l-amber-400 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="text-sm text-amber-900">De AI-generator is bezig. Dit duurt meestal 1-3 minuten.</p>
        </div>
      )}

      {scan.preview_status === 'failed' && (
        <div className="card p-4 bg-red-50 border-l-4 border-l-red-400">
          <p className="text-sm font-semibold text-red-900">Auto-preview gefaald.</p>
          {scan.preview_error && <p className="text-xs text-red-700 mt-1 font-mono">{scan.preview_error}</p>}
        </div>
      )}

      {scan.preview_status === 'ready' && scan.preview_glb_url && (
        <div className="card p-3">
          <div className="rounded-lg overflow-hidden bg-gravida-cream/40 mb-3" style={{ height: 360 }}>
            {/* @ts-ignore - model-viewer is a custom element from Google */}
            <model-viewer
              src={scan.preview_glb_url}
              alt="3D preview van de klant-scan"
              camera-controls
              auto-rotate
              auto-rotate-delay="1200"
              shadow-intensity="1"
              exposure="1.1"
              style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {scan.preview_stl_url && (
              <a href={scan.preview_stl_url} download={`gravida-${scan.session_id}-preview.stl`}
                className="btn-primary text-sm">
                Download STL voor digital sculpting
              </a>
            )}
            <a href={scan.preview_glb_url} download={`gravida-${scan.session_id}-preview.glb`}
              className="text-sm text-gravida-sage hover:text-gravida-green underline">
              Download GLB
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function PhotoTile({ p, selected, onToggle }: { p: Photo, selected: boolean, onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className={`relative rounded-xl overflow-hidden border-2 transition-colors ${selected ? 'border-gravida-green' : 'border-transparent hover:border-gravida-cream'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.blob_url} alt={`${p.angle} ${p.order_idx}`} loading="lazy" className="w-full aspect-square object-cover bg-gravida-cream" />
      <div className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${selected ? 'bg-gravida-green text-white' : 'bg-white/80 text-gravida-green'}`}>
        {p.angle === 'detail' ? (p.note || 'detail') : p.angle}
      </div>
      {selected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gravida-green text-white text-xs flex items-center justify-center">✓</div>
      )}
    </button>
  )
}
