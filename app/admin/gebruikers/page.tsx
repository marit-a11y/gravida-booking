'use client'

import { useEffect, useState } from 'react'
import { PAGES } from '@/lib/pages'

interface User {
  id: number
  name: string
  email: string
  is_admin: boolean
  is_active: boolean
  allowed_pages: string[]
  last_login: string | null
  created_at: string
}

const EMPTY = {
  name: '', email: '', password: '', is_admin: false,
  is_active: true, allowed_pages: [] as string[],
}

export default function GebruikersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<User | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<typeof EMPTY>(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/dashboard-users', { credentials: 'include' })
      const d = await r.json()
      if (r.ok) setUsers(d.users ?? [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null); setForm(EMPTY); setError(''); setShowNew(true)
  }
  const openEdit = (u: User) => {
    setEditing(u)
    setForm({
      name: u.name, email: u.email, password: '',
      is_admin: u.is_admin, is_active: u.is_active,
      allowed_pages: Array.isArray(u.allowed_pages) ? u.allowed_pages : [],
    })
    setError(''); setShowNew(true)
  }
  const close = () => { setShowNew(false); setEditing(null); setError('') }

  const save = async () => {
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/admin/dashboard-users/${editing.id}` : '/api/admin/dashboard-users'
      const method = editing ? 'PUT' : 'POST'
      const body: Record<string, unknown> = {
        name: form.name, email: form.email,
        is_admin: form.is_admin, is_active: form.is_active,
        allowed_pages: form.allowed_pages,
      }
      if (form.password) body.password = form.password
      const r = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error ?? 'Opslaan mislukt'); setSaving(false); return
      }
      close(); await load()
    } finally { setSaving(false) }
  }

  const remove = async (u: User) => {
    if (!confirm(`Gebruiker ${u.name} (${u.email}) definitief verwijderen?`)) return
    const r = await fetch(`/api/admin/dashboard-users/${u.id}`, {
      method: 'DELETE', credentials: 'include',
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      alert('Verwijderen mislukt: ' + (d.error ?? r.status))
      return
    }
    await load()
  }

  const togglePage = (slug: string) => {
    setForm(f => ({
      ...f,
      allowed_pages: f.allowed_pages.includes(slug)
        ? f.allowed_pages.filter(s => s !== slug)
        : [...f.allowed_pages, slug],
    }))
  }
  const pageGroups = PAGES

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Gebruikers</h1>
          <p className="text-gravida-sage mt-1 text-sm">Beheer wie toegang heeft tot het dashboard en welke pagina&apos;s ze mogen zien.</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nieuwe gebruiker</button>
      </div>

      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="card flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gravida-green">{u.name}</h3>
                  <span className="text-xs text-gravida-sage">{u.email}</span>
                  {u.is_admin && <span className="text-[10px] bg-gravida-green text-white px-2 py-0.5 rounded-full">Admin</span>}
                  {!u.is_active && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Inactief</span>}
                </div>
                <p className="text-[11px] text-gravida-light-sage mt-1">
                  {u.is_admin
                    ? 'Volledige toegang tot alle pagina\'s'
                    : `${(u.allowed_pages ?? []).length} pagina${(u.allowed_pages ?? []).length === 1 ? '' : "'s"} toegestaan`}
                  {u.last_login && ` · laatst ingelogd ${new Date(u.last_login).toLocaleString('nl-NL')}`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(u)} className="text-xs px-3 py-1.5 rounded bg-white border border-gravida-cream hover:border-gravida-sage text-gravida-sage">
                  ✎ Bewerken
                </button>
                <button onClick={() => remove(u)} className="text-xs px-3 py-1.5 rounded bg-white border border-red-200 text-red-600 hover:bg-red-50">
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={close}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gravida-cream flex justify-between items-start">
              <h2 className="text-lg font-bold text-gravida-sage">
                {editing ? `Bewerken: ${editing.name}` : 'Nieuwe gebruiker'}
              </h2>
              <button onClick={close} className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Naam *</label>
                  <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">E-mail *</label>
                  <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">
                  Wachtwoord {editing && <span className="text-gravida-light-sage text-xs font-normal">(laat leeg om huidige te behouden)</span>}
                  {!editing && <span className="text-red-500"> *</span>}
                </label>
                <input type="password" className="input-field"
                  placeholder={editing ? '••••••' : 'Min. 8 tekens'}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>

              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_admin} onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))} />
                  <span className="text-sm">Admin (volledige toegang tot alles)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                  <span className="text-sm">Actief (kan inloggen)</span>
                </label>
              </div>

              {!form.is_admin && (
                <div>
                  <label className="label">Toegestane pagina&apos;s</label>
                  <div className="space-y-3">
                    {Array.from(new Set(pageGroups.map(p => p.group))).map(group => (
                      <div key={group}>
                        <p className="text-[10px] uppercase tracking-wider text-gravida-light-sage font-semibold mb-1">{group}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {pageGroups.filter(p => p.group === group).map(p => (
                            <label key={p.slug} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-gravida-off-white">
                              <input
                                type="checkbox"
                                checked={form.allowed_pages.includes(p.slug)}
                                onChange={() => togglePage(p.slug)}
                              />
                              <span>{p.label}</span>
                              <span className="text-[10px] text-gravida-light-sage font-mono ml-auto">{p.slug}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={close} className="btn-secondary">Annuleren</button>
                <button onClick={save} disabled={saving || !form.name || !form.email || (!editing && !form.password)}
                  className="btn-primary disabled:opacity-50">
                  {saving ? 'Opslaan...' : editing ? 'Wijzigingen opslaan' : 'Aanmaken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

