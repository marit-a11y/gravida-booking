'use client'

import { useEffect, useMemo, useState } from 'react'

interface Folder {
  id: number
  name: string
  category: string | null
  parent_id: number | null
  item_count: number
}

interface MediaItem {
  id: number
  blob_url: string
  type: 'image' | 'video'
  filename: string | null
  label: string | null
}

interface Props {
  open: boolean
  onClose: () => void
  onPick: (urls: string[]) => void
  /** Welke types tonen? Default: alles */
  accept?: 'all' | 'image' | 'video'
  /** Mag meer dan één geselecteerd worden? Default: true */
  multi?: boolean
}

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url)
}

export default function MediaLibraryPicker({ open, onClose, onPick, accept = 'all', multi = true }: Props) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [items, setItems] = useState<MediaItem[]>([])
  const [activeFolder, setActiveFolder] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>(accept === 'all' ? 'all' : accept)

  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    fetch('/api/admin/media-folders').then(r => r.json()).then(d => setFolders(d.folders ?? []))
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const url = activeFolder === 'all'
      ? '/api/admin/media-items'
      : `/api/admin/media-items?folder_id=${activeFolder}`
    fetch(url)
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .finally(() => setLoading(false))
  }, [activeFolder, open])

  const filtered = useMemo(() => {
    return items.filter(it => {
      const isVideo = it.type === 'video' || isVideoUrl(it.blob_url)
      if (typeFilter === 'image' && isVideo) return false
      if (typeFilter === 'video' && !isVideo) return false
      if (search.trim()) {
        const s = search.toLowerCase()
        const txt = `${it.filename ?? ''} ${it.label ?? ''}`.toLowerCase()
        if (!txt.includes(s)) return false
      }
      return true
    })
  }, [items, typeFilter, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Folder[]>()
    for (const f of folders) {
      const cat = f.category ?? 'Overig'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(f)
    }
    return Array.from(map.entries())
  }, [folders])

  const toggle = (url: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(url)) next.delete(url)
      else {
        if (!multi) next.clear()
        next.add(url)
      }
      return next
    })
  }

  const confirm = () => {
    onPick(Array.from(selected))
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gravida-cream">
          <h2 className="font-semibold text-gravida-green">Kies uit mediabibliotheek</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center">✕</button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <aside className="w-48 shrink-0 border-r border-gravida-cream overflow-y-auto p-3">
            <button
              onClick={() => setActiveFolder('all')}
              className={`w-full text-left text-sm px-2 py-1.5 rounded mb-2 ${activeFolder === 'all' ? 'bg-gravida-cream' : 'hover:bg-gravida-off-white'}`}
            >📁 Alles</button>
            {grouped.map(([cat, fldrs]) => (
              <div key={cat} className="mb-2">
                <p className="text-[10px] uppercase tracking-wider text-gravida-light-sage font-semibold mb-1 px-2">{cat}</p>
                {fldrs.filter(f => !f.parent_id).map(f => {
                  const children = fldrs.filter(c => c.parent_id === f.id)
                  return (
                    <div key={f.id}>
                      <button
                        onClick={() => setActiveFolder(f.id)}
                        className={`w-full text-left text-xs px-2 py-1 rounded flex items-center justify-between ${activeFolder === f.id ? 'bg-gravida-sage text-white' : 'hover:bg-gravida-off-white text-gravida-sage'}`}
                      >
                        <span className="truncate">{f.name}</span>
                        <span className="text-[10px] opacity-70 ml-1">{f.item_count}</span>
                      </button>
                      {children.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setActiveFolder(c.id)}
                          className={`w-full text-left text-[11px] pl-5 pr-2 py-1 rounded flex items-center justify-between ${activeFolder === c.id ? 'bg-gravida-sage text-white' : 'hover:bg-gravida-off-white text-gravida-sage'}`}
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] opacity-70 ml-1">{c.item_count}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </aside>

          {/* Main */}
          <main className="flex-1 flex flex-col min-w-0">
            <div className="p-3 border-b border-gravida-cream flex items-center gap-2 flex-wrap">
              <input
                type="text"
                placeholder="Zoek..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field text-xs flex-1 min-w-[160px]"
              />
              {accept === 'all' && (
                <div className="flex gap-1">
                  {(['all', 'image', 'video'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`text-xs px-2 py-1 rounded ${typeFilter === t ? 'bg-gravida-sage text-white' : 'bg-gravida-cream text-gravida-sage hover:bg-gravida-off-white'}`}
                    >
                      {t === 'all' ? 'Alles' : t === 'image' ? '📷' : '🎬'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {loading ? (
                <p className="text-sm text-gravida-light-sage">Laden...</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-gravida-light-sage italic">Geen bestanden gevonden.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filtered.map(it => {
                    const isVideo = it.type === 'video' || isVideoUrl(it.blob_url)
                    const isSel = selected.has(it.blob_url)
                    return (
                      <button
                        key={it.id}
                        onClick={() => toggle(it.blob_url)}
                        className={`relative rounded-lg overflow-hidden border-2 transition-colors text-left ${isSel ? 'border-gravida-green ring-2 ring-gravida-green/30' : 'border-gravida-cream hover:border-gravida-sage'}`}
                      >
                        {isVideo ? (
                          /* eslint-disable-next-line jsx-a11y/media-has-caption */
                          <video src={it.blob_url} className="w-full h-28 object-cover bg-black" muted playsInline />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={it.blob_url} alt={it.label ?? ''} className="w-full h-28 object-cover" />
                        )}
                        {isSel && (
                          <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-gravida-green text-white text-xs flex items-center justify-center font-bold">
                            {Array.from(selected).indexOf(it.blob_url) + 1}
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                          {isVideo ? '🎬' : '📷'}
                        </div>
                        {it.label && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[10px] px-1.5 py-2 pt-4 truncate">
                            {it.label}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gravida-cream flex items-center justify-between gap-3 bg-gravida-off-white/50">
          <p className="text-xs text-gravida-sage">
            {selected.size === 0
              ? 'Tip: klik op miniaturen om te selecteren.'
              : `${selected.size} bestand${selected.size === 1 ? '' : 'en'} geselecteerd`}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs">Annuleren</button>
            <button
              onClick={confirm}
              disabled={selected.size === 0}
              className="btn-primary text-xs disabled:opacity-50"
            >
              Voeg {selected.size > 0 ? `${selected.size} ` : ''}toe
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
