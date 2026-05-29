'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'

const StlViewer = dynamic(() => import('./StlViewer'), { ssr: false })

interface ScanFile {
  id: number
  rental_id: number
  scan_label: number
  blob_url: string
  filename: string | null
  size_bytes: number | null
  notes: string | null
  is_chosen: boolean
  created_at: string
}

interface Props {
  rentalId?: number
  bookingId?: number
  customerNumber?: string | null
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '?'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function StlManager({ rentalId, bookingId, customerNumber }: Props) {
  const ownerKey = rentalId ? `rental_id=${rentalId}` : bookingId ? `booking_id=${bookingId}` : ''
  const ownerPathSeg = rentalId ? `rental-${rentalId}` : bookingId ? `booking-${bookingId}` : 'unknown'
  const [files, setFiles] = useState<ScanFile[]>([])
  const [consentChosenLabel, setConsentChosenLabel] = useState<number | null>(null)
  const [manualChosenLabel, setManualChosenLabel] = useState<number | null>(null)
  const [consentSubmittedAt, setConsentSubmittedAt] = useState<string | null>(null)
  const chosenLabel = consentChosenLabel ?? manualChosenLabel
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [openViewer, setOpenViewer] = useState<number | null>(null)
  const [activeLabel, setActiveLabel] = useState<1 | 2>(1)
  const [deleteMarks, setDeleteMarks] = useState<Set<number>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!ownerKey) { setLoading(false); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/diy-scan-files?${ownerKey}`, { credentials: 'include' })
      const d = await r.json()
      if (r.ok) {
        setFiles(d.files ?? [])
        setConsentChosenLabel(d.chosen_label ?? null)
        setConsentSubmittedAt(d.consent_submitted_at ?? null)
      } else {
        setError(d.error ?? 'Laden mislukt')
      }
    } finally {
      setLoading(false)
    }
  }, [ownerKey])

  useEffect(() => { load() }, [load])

  // Pre-select de niet-gekozen scan als verwijder-voorstel zodra klant heeft gekozen
  useEffect(() => {
    if (chosenLabel && files.length > 0 && deleteMarks.size === 0 && !confirmingDelete) {
      const unchosen = files.filter(f => f.scan_label !== chosenLabel).map(f => f.id)
      if (unchosen.length > 0) setDeleteMarks(new Set(unchosen))
    }
  }, [chosenLabel, files, deleteMarks.size, confirmingDelete])

  const uploadFiles = async (selected: File[]) => {
    if (selected.length === 0) return
    setUploading(true); setError('')
    let upload: typeof import('@vercel/blob/client').upload
    try {
      const mod = await import('@vercel/blob/client')
      upload = mod.upload
    } catch (err) {
      setError('Upload library laden mislukt: ' + String(err))
      setUploading(false); return
    }

    let done = 0
    for (const file of selected) {
      setUploadProgress(`Uploaden ${file.name} (${done + 1}/${selected.length})`)
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
        const pathname = `scans/${ownerPathSeg}/scan${activeLabel}-${Date.now()}-${safe}`
        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: '/api/admin/diy-scan-files/upload',
          contentType: file.type || 'application/octet-stream',
        })
        const res = await fetch('/api/admin/diy-scan-files', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rental_id: rentalId ?? null,
            booking_id: bookingId ?? null,
            scan_label: activeLabel,
            blob_url: blob.url,
            blob_pathname: pathname,
            filename: file.name,
            size_bytes: file.size,
          }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setError(`DB save mislukt: ${file.name} - ${d.error ?? res.status}`)
        }
        done++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(`Upload mislukt voor ${file.name}: ${msg}`)
      }
    }
    setUploading(false); setUploadProgress('')
    await load()
  }

  const deleteOne = async (id: number) => {
    if (!confirm('Dit bestand definitief verwijderen?')) return
    await fetch(`/api/admin/diy-scan-files/${id}`, { method: 'DELETE', credentials: 'include' })
    await load()
  }

  const toggleMark = (id: number) => {
    setDeleteMarks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const executeBatchDelete = async () => {
    if (deleteMarks.size === 0) return
    if (!confirm(`${deleteMarks.size} scanbestand(en) definitief verwijderen?`)) return
    setConfirmingDelete(true)
    try {
      const res = await fetch('/api/admin/diy-scan-files/batch-delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(deleteMarks) }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Verwijderen mislukt')
      } else {
        setDeleteMarks(new Set())
        await load()
      }
    } finally {
      setConfirmingDelete(false)
    }
  }

  const filesByLabel = (label: 1 | 2) => files.filter(f => f.scan_label === label)

  return (
    <div className="card p-6">
      <h2 className="section-title mb-1">3D scanbestanden (STL)</h2>
      <p className="text-xs text-gravida-sage mb-4">
        Upload de .stl bestanden die uit de DIY scanner komen. Groepeer ze als <strong>Scan 1</strong> of <strong>Scan 2</strong> zodat de klant zijn voorkeur kan koppelen via het toestemmingsformulier.
      </p>

      {/* Tab voor actieve scan-groep (waar nieuwe uploads heen gaan) */}
      <div className="flex gap-2 mb-4">
        {[1, 2].map(n => {
          const isActive = activeLabel === n
          const count = filesByLabel(n as 1 | 2).length
          return (
            <button
              key={n}
              type="button"
              onClick={() => setActiveLabel(n as 1 | 2)}
              className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                isActive
                  ? 'bg-gravida-green text-white border-gravida-green'
                  : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage'
              }`}
            >
              Scan {customerNumber ? `${customerNumber}-${n}` : n}
              <span className={`ml-2 text-xs ${isActive ? 'opacity-80' : 'opacity-60'}`}>({count})</span>
            </button>
          )
        })}
      </div>

      {/* Upload knop */}
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          {uploading ? 'Uploaden...' : `+ Upload STL naar Scan ${activeLabel}`}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".stl"
          multiple
          style={{ display: 'none' }}
          onChange={e => {
            const arr = e.target.files ? Array.from(e.target.files) : []
            e.target.value = ''
            uploadFiles(arr)
          }}
        />
        {uploading && uploadProgress && (
          <span className="text-xs text-gravida-sage">⏳ {uploadProgress}</span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>
      )}

      {/* Klantkeuze banner OF handmatige keuze (voor aan-huis zonder consent) */}
      {consentChosenLabel ? (
        <div className="mb-4 p-3 rounded-xl bg-gravida-green/5 border border-gravida-green/30">
          <p className="text-sm">
            <span className="font-semibold text-gravida-green">Klantkeuze ontvangen via toestemmingsformulier:</span> Scan {consentChosenLabel}.
            {consentSubmittedAt && (
              <span className="text-gravida-sage ml-1 text-xs">
                ({new Date(consentSubmittedAt).toLocaleString('nl-NL')})
              </span>
            )}
          </p>
          <p className="text-xs text-gravida-sage mt-1">
            De niet-gekozen scan staat hieronder voorgesteld om te verwijderen. Pas aan als je iets wil bewaren.
          </p>
        </div>
      ) : files.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-800 mb-2">
            <strong>Geen toestemmingsformulier?</strong> Markeer hieronder zelf welke scan de klant heeft gekozen, dan stellen we de andere scan voor om te verwijderen.
          </p>
          <div className="flex gap-2 flex-wrap">
            {[1, 2].map(n => {
              const isActive = manualChosenLabel === n
              const hasFiles = filesByLabel(n as 1 | 2).length > 0
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!hasFiles}
                  onClick={() => {
                    setManualChosenLabel(isActive ? null : n)
                    if (isActive) setDeleteMarks(new Set())
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                    isActive
                      ? 'bg-gravida-green text-white border-gravida-green'
                      : 'bg-white border-gravida-cream text-gravida-sage hover:border-gravida-sage'
                  }`}
                >
                  {isActive ? '✓ ' : ''}Scan {n} gekozen
                </button>
              )
            })}
            {manualChosenLabel && (
              <span className="text-xs text-gravida-sage self-center">
                → de andere scan staat hieronder voorgesteld om te verwijderen
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bestanden per groep */}
      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-gravida-light-sage italic">Nog geen STL bestanden geüpload.</p>
      ) : (
        <div className="space-y-5">
          {[1, 2].map(label => {
            const groupFiles = filesByLabel(label as 1 | 2)
            if (groupFiles.length === 0) return null
            const isChosenGroup = chosenLabel === label
            return (
              <div key={label}>
                <h3 className={`text-sm font-semibold mb-2 ${isChosenGroup ? 'text-gravida-green' : 'text-gravida-sage'}`}>
                  Scan {customerNumber ? `${customerNumber}-${label}` : label}
                  {isChosenGroup && <span className="ml-2 text-[10px] bg-gravida-green text-white px-2 py-0.5 rounded-full">Gekozen door klant</span>}
                </h3>
                <div className="space-y-2">
                  {groupFiles.map(f => {
                    const isOpen = openViewer === f.id
                    const isMarked = deleteMarks.has(f.id)
                    return (
                      <div key={f.id} className={`border-2 rounded-xl ${isMarked ? 'border-red-300 bg-red-50/40' : 'border-gravida-cream'}`}>
                        <div className="flex items-center justify-between p-3 gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gravida-green truncate" title={f.filename ?? ''}>
                              {f.filename ?? `Scan ${label} bestand`}
                            </p>
                            <p className="text-[11px] text-gravida-light-sage">
                              {formatSize(f.size_bytes)} · {new Date(f.created_at).toLocaleString('nl-NL')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {chosenLabel && (
                              <label className="flex items-center gap-1 text-xs text-gravida-sage cursor-pointer">
                                <input type="checkbox" checked={isMarked} onChange={() => toggleMark(f.id)} />
                                Verwijder
                              </label>
                            )}
                            <button
                              type="button"
                              onClick={() => setOpenViewer(isOpen ? null : f.id)}
                              className="text-xs px-2 py-1 rounded-lg bg-gravida-cream text-gravida-sage hover:bg-gravida-off-white"
                            >
                              {isOpen ? '▲ sluiten' : '👁 3D'}
                            </button>
                            <a href={f.blob_url} target="_blank" rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded-lg bg-gravida-cream text-gravida-sage hover:bg-gravida-off-white">
                              ⬇
                            </a>
                            <button
                              type="button"
                              onClick={() => deleteOne(f.id)}
                              className="text-xs px-2 py-1 rounded-lg text-red-500 hover:bg-red-50"
                              title="Verwijder dit bestand"
                            >✕</button>
                          </div>
                        </div>
                        {isOpen && (
                          <div className="px-3 pb-3">
                            <StlViewer url={f.blob_url} height={360} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Batch delete actie */}
      {chosenLabel && deleteMarks.size > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">
            <strong>{deleteMarks.size}</strong> bestand(en) gemarkeerd om te verwijderen.
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDeleteMarks(new Set())}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage"
            >Selectie wissen</button>
            <button
              type="button"
              onClick={executeBatchDelete}
              disabled={confirmingDelete}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >{confirmingDelete ? 'Verwijderen...' : `Verwijder ${deleteMarks.size}`}</button>
          </div>
        </div>
      )}
    </div>
  )
}
