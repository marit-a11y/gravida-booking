'use client'

import { useEffect, useState } from 'react'

interface Gallery {
  id: number
  slug: string
  title: string
  description: string | null
  cover_image_url: string | null
  is_published: boolean
  sort_order: number
  photo_count: number
}

interface Photo {
  id: number
  image_url: string
  caption: string | null
  sort_order: number
}

export default function GalleriesPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Gallery | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [form, setForm] = useState({ title: '', description: '', is_published: false })
  const [uploading, setUploading] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/galleries')
    const d = await r.json()
    setGalleries(d.galleries ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openEdit = async (g: Gallery) => {
    setEditing(g)
    setForm({ title: g.title, description: g.description ?? '', is_published: g.is_published })
    const r = await fetch(`/api/admin/galleries/${g.id}`)
    const d = await r.json()
    setPhotos(d.photos ?? [])
  }
  const closeEdit = () => { setEditing(null); setPhotos([]) }

  const saveEdit = async () => {
    if (!editing) return
    await fetch(`/api/admin/galleries/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    await load()
    closeEdit()
  }

  const createNew = async () => {
    if (!form.title.trim()) return
    const r = await fetch('/api/admin/galleries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const d = await r.json()
    setShowNew(false)
    setForm({ title: '', description: '', is_published: false })
    await load()
    if (d.gallery) {
      openEdit({ ...d.gallery, photo_count: 0 })
    }
  }

  const removeGallery = async (id: number) => {
    if (!confirm('Hele galerij + alle foto\'s verwijderen?')) return
    await fetch(`/api/admin/galleries/${id}`, { method: 'DELETE' })
    await load()
  }

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editing) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'galleries')
      const res = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.url) {
        await fetch(`/api/admin/galleries/${editing.id}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: data.url, sort_order: photos.length }),
        })
      }
    }
    setUploading(false)
    // refresh photos
    const r = await fetch(`/api/admin/galleries/${editing.id}`)
    const d = await r.json()
    setPhotos(d.photos ?? [])
    await load()
  }

  const removePhoto = async (id: number) => {
    if (!confirm('Foto verwijderen?')) return
    await fetch(`/api/admin/gallery-photos/${id}`, { method: 'DELETE' })
    setPhotos(prev => prev.filter(p => p.id !== id))
    await load()
  }

  const updateCaption = async (id: number, caption: string) => {
    await fetch(`/api/admin/gallery-photos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    })
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, caption } : p))
  }

  const setCover = async (url: string) => {
    if (!editing) return
    await fetch(`/api/admin/galleries/${editing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cover_image_url: url }),
    })
    setEditing({ ...editing, cover_image_url: url })
    await load()
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Galerijen</h1>
          <p className="text-gravida-sage mt-1 text-sm">Inspiratie-galerijen voor de website. Verschijnen op gravida.nl als ze gepubliceerd zijn.</p>
        </div>
        <button onClick={() => { setShowNew(true); setForm({ title: '', description: '', is_published: false }) }} className="btn-primary">
          + Nieuwe galerij
        </button>
      </div>

      {/* Lijst */}
      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : galleries.length === 0 ? (
        <p className="text-sm text-gravida-light-sage">Nog geen galerijen. Maak er een aan met de knop hierboven.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {galleries.map(g => (
            <div key={g.id} className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(g)}>
              {g.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.cover_image_url} alt={g.title} className="w-full h-40 object-cover rounded-lg mb-3" />
              ) : (
                <div className="w-full h-40 bg-gravida-cream rounded-lg flex items-center justify-center text-3xl text-gravida-light-sage mb-3">📷</div>
              )}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gravida-green truncate">{g.title}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${g.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {g.is_published ? 'Live' : 'Concept'}
                </span>
              </div>
              <p className="text-xs text-gravida-light-sage mt-1">
                {g.photo_count} foto{g.photo_count === 1 ? '' : '\'s'} &middot; /{g.slug}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Nieuwe modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gravida-sage">Nieuwe galerij</h2>
            <div>
              <label className="label">Titel *</label>
              <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Beschrijving</label>
              <textarea rows={3} className="input-field" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} />
              <span>Direct publiceren</span>
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Annuleren</button>
              <button onClick={createNew} disabled={!form.title.trim()} className="btn-primary">Aanmaken</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gravida-sage">{editing.title}</h2>
                <p className="text-xs text-gravida-light-sage font-mono">/{editing.slug}</p>
              </div>
              <button onClick={closeEdit} className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Titel</label>
                  <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Beschrijving</label>
                  <textarea rows={2} className="input-field" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} />
                <span>Gepubliceerd (zichtbaar op de website)</span>
              </label>
              <div className="flex gap-2">
                <button onClick={saveEdit} className="btn-primary">Wijzigingen opslaan</button>
                <button onClick={() => removeGallery(editing.id)} className="btn-danger">Galerij verwijderen</button>
              </div>

              <hr className="my-2 border-gravida-cream" />

              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gravida-green">Foto&apos;s ({photos.length})</h3>
                  <label className={`cursor-pointer text-xs px-3 py-1.5 rounded-lg bg-gravida-sage text-white hover:bg-gravida-green ${uploading ? 'opacity-50' : ''}`}>
                    {uploading ? 'Uploaden...' : '+ Foto\'s toevoegen'}
                    <input type="file" className="hidden" accept="image/*" multiple
                      onChange={e => { uploadPhotos(e.target.files); e.target.value = '' }} />
                  </label>
                </div>
                {photos.length === 0 ? (
                  <p className="text-sm text-gravida-light-sage italic">Nog geen foto&apos;s. Voeg toe via de knop hierboven.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map(p => (
                      <div key={p.id} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.image_url} alt={p.caption ?? ''} className="w-full h-32 object-cover rounded-lg border border-gravida-cream" />
                        <button onClick={() => removePhoto(p.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100">✕</button>
                        <button onClick={() => setCover(p.image_url)}
                          className={`absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded ${editing.cover_image_url === p.image_url ? 'bg-gravida-green text-white' : 'bg-white/90 text-gravida-sage opacity-0 group-hover:opacity-100'}`}>
                          {editing.cover_image_url === p.image_url ? '✓ cover' : 'als cover'}
                        </button>
                        <input
                          placeholder="Caption..."
                          defaultValue={p.caption ?? ''}
                          onBlur={e => updateCaption(p.id, e.target.value)}
                          className="w-full mt-1 text-xs px-2 py-1 border border-gravida-cream rounded" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
