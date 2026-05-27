'use client'

import { useEffect, useMemo, useState } from 'react'

interface Folder {
  id: number
  name: string
  slug: string
  category: string | null
  description: string | null
  sort_order: number
  parent_id: number | null
  item_count: number
}

interface MediaItem {
  id: number
  folder_id: number | null
  blob_url: string
  type: 'image' | 'video'
  filename: string | null
  label: string | null
  caption: string | null
  product_url: string | null
  created_at: string
}

const CATEGORY_ORDER = ['Materiaal', 'Sieraad', 'Webshop', 'Sfeer']

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url)
}

export default function MediaLibraryPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFolder, setActiveFolder] = useState<number | 'unfiled' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderForm, setFolderForm] = useState({ name: '', category: 'Materiaal', description: '', parent_id: '' as string })

  const loadFolders = async () => {
    const r = await fetch('/api/admin/media-folders')
    const d = await r.json()
    setFolders(d.folders ?? [])
  }
  const loadItems = async () => {
    let url = '/api/admin/media-items'
    if (activeFolder === 'unfiled') url += '?unfiled=1'
    else if (typeof activeFolder === 'number') url += `?folder_id=${activeFolder}`
    const r = await fetch(url)
    const d = await r.json()
    setItems(d.items ?? [])
  }
  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadFolders(), loadItems()])
    setLoading(false)
  }
  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadItems() }, [activeFolder]) // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const map = new Map<string, Folder[]>()
    for (const f of folders) {
      const cat = f.category ?? 'Overig'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(f)
    }
    return Array.from(map.entries()).sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a[0])
      const bi = CATEGORY_ORDER.indexOf(b[0])
      if (ai < 0 && bi < 0) return a[0].localeCompare(b[0])
      if (ai < 0) return 1
      if (bi < 0) return -1
      return ai - bi
    })
  }, [folders])

  const createFolder = async () => {
    if (!folderForm.name.trim()) return
    await fetch('/api/admin/media-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...folderForm,
        parent_id: folderForm.parent_id ? parseInt(folderForm.parent_id, 10) : null,
      }),
    })
    setShowNewFolder(false)
    setFolderForm({ name: '', category: 'Materiaal', description: '', parent_id: '' })
    await loadFolders()
  }

  const [uploadProgress, setUploadProgress] = useState<string>('')

  const uploadFiles = async (files: FileList | null) => {
    console.log('[media-library] uploadFiles called', files?.length, 'files')
    if (!files || files.length === 0) return
    setUploading(true); setUploadError(''); setUploadProgress(`Voorbereiden ${files.length} bestand(en)...`)

    let upload: typeof import('@vercel/blob/client').upload
    try {
      const mod = await import('@vercel/blob/client')
      upload = mod.upload
      console.log('[media-library] @vercel/blob/client loaded')
    } catch (err) {
      console.error('[media-library] failed to load @vercel/blob/client', err)
      setUploadError('Library laden mislukt: ' + String(err))
      setUploading(false); setUploadProgress('')
      return
    }

    let done = 0
    for (const file of Array.from(files)) {
      setUploadProgress(`Uploading ${file.name} (${done + 1}/${files.length})...`)
      console.log('[media-library] upload start', file.name, file.size, file.type)
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
        const pathname = `media-library/${Date.now()}-${safe}`
        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: '/api/admin/media-library/upload',
          contentType: file.type,
        })
        console.log('[media-library] upload ok', blob.url)
        const isVideo = file.type.startsWith('video/')
        const targetFolder = typeof activeFolder === 'number' ? activeFolder : null
        const res = await fetch('/api/admin/media-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder_id: targetFolder,
            blob_url: blob.url,
            type: isVideo ? 'video' : 'image',
            filename: file.name,
            size_bytes: file.size,
          }),
        })
        console.log('[media-library] db save status', res.status)
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setUploadError(`DB save mislukt: ${file.name} - ${d.error ?? res.status}`)
        }
        done++
      } catch (err) {
        console.error('[media-library] upload failed', file.name, err)
        const msg = err instanceof Error ? err.message : String(err)
        setUploadError(`Upload mislukt voor ${file.name}: ${msg}`)
      }
    }
    setUploading(false); setUploadProgress('')
    await loadAll()
  }

  const moveToFolder = async (itemId: number, folderId: number | null) => {
    await fetch(`/api/admin/media-items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_id: folderId }),
    })
    await loadAll()
  }

  const updateLabel = async (itemId: number, label: string) => {
    await fetch(`/api/admin/media-items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, label } : i))
  }

  const updateProductUrl = async (itemId: number, product_url: string) => {
    await fetch(`/api/admin/media-items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_url: product_url || null }),
    })
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, product_url: product_url || null } : i))
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Bestand verwijderen?')) return
    await fetch(`/api/admin/media-items/${id}`, { method: 'DELETE' })
    await loadAll()
  }

  const activeFolderObj = typeof activeFolder === 'number' ? folders.find(f => f.id === activeFolder) : null
  const unfiledCount = items.filter(i => !i.folder_id).length

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <div className="card sticky top-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gravida-green">Mappen</h2>
            <button onClick={() => setShowNewFolder(true)} className="text-xs px-2 py-1 rounded bg-gravida-sage text-white hover:bg-gravida-green">+ Nieuw</button>
          </div>

          <button onClick={() => setActiveFolder(null)}
            className={`w-full text-left text-sm px-2 py-1.5 rounded mb-1 ${activeFolder === null ? 'bg-gravida-cream' : 'hover:bg-gravida-off-white'}`}>
            📁 Alles
          </button>

          <button onClick={() => setActiveFolder('unfiled')}
            className={`w-full text-left text-sm px-2 py-1.5 rounded mb-3 ${activeFolder === 'unfiled' ? 'bg-amber-100' : 'hover:bg-gravida-off-white'}`}>
            ⚠️ Zonder map
          </button>

          {grouped.map(([cat, fldrs]) => {
            // Maak parent → children map zodat we 2 niveaus diep kunnen renderen
            const roots = fldrs.filter(f => !f.parent_id)
            const childrenOf = (pid: number) => fldrs.filter(f => f.parent_id === pid)
            return (
              <div key={cat} className="mb-3">
                <p className="text-[10px] uppercase tracking-wider text-gravida-light-sage font-semibold mb-1 px-2">{cat}</p>
                {roots.map(f => {
                  const kids = childrenOf(f.id)
                  return (
                    <div key={f.id}>
                      <button onClick={() => setActiveFolder(f.id)}
                        className={`w-full text-left text-sm px-2 py-1.5 rounded flex items-center justify-between ${activeFolder === f.id ? 'bg-gravida-sage text-white' : 'hover:bg-gravida-off-white text-gravida-sage'}`}>
                        <span className="truncate">{f.name}</span>
                        <span className={`text-[10px] ml-1 px-1.5 py-0.5 rounded ${activeFolder === f.id ? 'bg-white/20 text-white' : 'bg-gravida-cream text-gravida-light-sage'}`}>
                          {f.item_count}
                        </span>
                      </button>
                      {kids.length > 0 && (
                        <div className="ml-3 border-l border-gravida-cream pl-2 mt-0.5 mb-1">
                          {kids.map(c => (
                            <button key={c.id} onClick={() => setActiveFolder(c.id)}
                              className={`w-full text-left text-xs px-2 py-1 rounded flex items-center justify-between ${activeFolder === c.id ? 'bg-gravida-sage text-white' : 'hover:bg-gravida-off-white text-gravida-sage'}`}>
                              <span className="truncate">{c.name}</span>
                              <span className={`text-[10px] ml-1 px-1.5 py-0.5 rounded ${activeFolder === c.id ? 'bg-white/20 text-white' : 'bg-gravida-cream text-gravida-light-sage'}`}>
                                {c.item_count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="page-title">
              {activeFolder === null ? 'Mediabibliotheek' :
               activeFolder === 'unfiled' ? 'Zonder map' :
               activeFolderObj?.name ?? '...'}
            </h1>
            <p className="text-gravida-sage text-sm mt-1">
              {activeFolder === null ? `${items.length} bestanden, ${unfiledCount} zonder map` :
               activeFolder === 'unfiled' ? 'Sleep deze nog in een map zodat Sonja ze makkelijk terug kan vinden' :
               activeFolderObj?.description ?? `${items.length} bestanden`}
            </p>
          </div>
          <label className={`cursor-pointer btn-primary ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? 'Uploaden...' : '+ Upload media'}
            <input type="file" className="hidden" accept="image/*,video/*" multiple
              onChange={e => { uploadFiles(e.target.files); e.target.value = '' }} />
          </label>
        </div>

        {uploading && uploadProgress && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">⏳ {uploadProgress}</div>
        )}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{uploadError}</div>
        )}

        {loading ? (
          <p className="text-sm text-gravida-light-sage">Laden...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gravida-light-sage italic">Geen bestanden in deze map. Upload via de knop rechtsboven.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(item => (
              <MediaCard key={item.id} item={item} folders={folders}
                onMove={(folderId) => moveToFolder(item.id, folderId)}
                onLabel={(label) => updateLabel(item.id, label)}
                onProductUrl={(url) => updateProductUrl(item.id, url)}
                onDelete={() => deleteItem(item.id)} />
            ))}
          </div>
        )}
      </main>

      {/* Nieuwe folder modal */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <h2 className="text-lg font-bold text-gravida-sage">Nieuwe map</h2>
            <div>
              <label className="label">Naam *</label>
              <input className="input-field" placeholder="Bijv. Najaarscollectie 2026"
                value={folderForm.name} onChange={e => setFolderForm({ ...folderForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Categorie</label>
              <select className="input-field" value={folderForm.category} onChange={e => setFolderForm({ ...folderForm, category: e.target.value })}>
                <option>Materiaal</option>
                <option>Sieraad</option>
                <option>Webshop</option>
                <option>Sfeer</option>
                <option>Overig</option>
              </select>
            </div>
            <div>
              <label className="label">Submap van (optioneel)</label>
              <select className="input-field" value={folderForm.parent_id}
                onChange={e => setFolderForm({ ...folderForm, parent_id: e.target.value })}>
                <option value="">— geen, hoofdmap —</option>
                {folders.filter(f => !f.parent_id).map(f => (
                  <option key={f.id} value={f.id}>{f.category ? `${f.category}: ` : ''}{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Beschrijving (optioneel)</label>
              <textarea rows={2} className="input-field" value={folderForm.description}
                onChange={e => setFolderForm({ ...folderForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewFolder(false)} className="btn-secondary">Annuleren</button>
              <button onClick={createFolder} disabled={!folderForm.name.trim()} className="btn-primary">Aanmaken</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MediaCard({ item, folders, onMove, onLabel, onProductUrl, onDelete }: {
  item: MediaItem
  folders: Folder[]
  onMove: (folderId: number | null) => void
  onLabel: (label: string) => void
  onProductUrl: (url: string) => void
  onDelete: () => void
}) {
  const [labelDraft, setLabelDraft] = useState(item.label ?? '')
  const [urlDraft, setUrlDraft] = useState(item.product_url ?? '')
  const isVideo = item.type === 'video' || isVideoUrl(item.blob_url)

  return (
    <div className="card p-3 group">
      <div className="relative mb-2">
        {isVideo ? (
          <video src={item.blob_url} className="w-full h-40 object-cover rounded-lg bg-black" muted playsInline />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.blob_url} alt="" className="w-full h-40 object-cover rounded-lg" />
        )}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <a href={item.blob_url} target="_blank" rel="noopener noreferrer"
            className="w-7 h-7 rounded-full bg-white/90 hover:bg-white text-gravida-sage text-xs flex items-center justify-center"
            title="Open / download">⬇</a>
          <button onClick={onDelete} className="w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs">✕</button>
        </div>
        <div className="absolute bottom-1 left-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
            {isVideo ? '🎬 video' : '📷 foto'}
          </span>
        </div>
      </div>

      <input
        placeholder="Label (bv. MB3A polished)"
        className="w-full text-xs px-2 py-1 border border-gravida-cream rounded mb-1"
        value={labelDraft}
        onChange={e => setLabelDraft(e.target.value)}
        onBlur={() => { if (labelDraft !== (item.label ?? '')) onLabel(labelDraft) }}
      />

      <select
        className="w-full text-xs px-2 py-1 border border-gravida-cream rounded text-gravida-sage"
        value={item.folder_id ?? ''}
        onChange={e => onMove(e.target.value ? parseInt(e.target.value, 10) : null)}
      >
        <option value="">— Geen map —</option>
        {folders.map(f => {
          const parent = f.parent_id ? folders.find(p => p.id === f.parent_id) : null
          const label = parent ? `${parent.name} › ${f.name}` : f.name
          return <option key={f.id} value={f.id}>{label}</option>
        })}
      </select>

      <input
        placeholder="Product-link (optioneel)"
        type="url"
        className="w-full text-xs px-2 py-1 border border-gravida-cream rounded mt-1"
        value={urlDraft}
        onChange={e => setUrlDraft(e.target.value)}
        onBlur={() => { if (urlDraft !== (item.product_url ?? '')) onProductUrl(urlDraft) }}
      />

      {item.product_url && (
        <a href={item.product_url} target="_blank" rel="noopener noreferrer"
          className="block mt-1 text-[11px] text-gravida-sage hover:text-gravida-green underline truncate"
          title={item.product_url}>
          🔗 Bekijk product
        </a>
      )}

      {item.filename && (
        <p className="text-[10px] text-gravida-light-sage mt-1 truncate" title={item.filename}>{item.filename}</p>
      )}
    </div>
  )
}
