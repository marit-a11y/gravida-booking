'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

interface InboxItem {
  id: number
  recipient: string
  sender: string | null
  type: string
  title: string
  body: string | null
  link: string | null
  related_task_id: number | null
  is_read: boolean
  created_at: string
}

// USERS wordt nu dynamisch geladen vanuit dashboard_users (zie state)

const TYPE_INFO: Record<string, { icon: string; bg: string }> = {
  task_assigned: { icon: '📋', bg: 'bg-blue-50 border-blue-200' },
  message:       { icon: '💬', bg: 'bg-purple-50 border-purple-200' },
  support_call:  { icon: '📞', bg: 'bg-green-50 border-green-200' },
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diffMin = (Date.now() - d.getTime()) / 60000
  if (diffMin < 1) return 'zojuist'
  if (diffMin < 60) return `${Math.round(diffMin)} min geleden`
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)} uur geleden`
  if (diffMin < 60 * 24 * 7) return `${Math.round(diffMin / 60 / 24)} dag(en) geleden`
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default function InboxPage() {
  const [me, setMe] = useState<string>('')
  const [users, setUsers] = useState<string[]>([])
  // Haal de ingelogde gebruiker + lijst van users op
  useEffect(() => {
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user?.name) setMe(d.user.name) })
      .catch(() => {})
    fetch('/api/admin/dashboard-users/names', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.names) setUsers(d.names) })
      .catch(() => {})
  }, [])
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('unread')

  // Compose
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeTo, setComposeTo] = useState<string>('')
  const [composeTitle, setComposeTitle] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sending, setSending] = useState(false)

  const load = async () => {
    if (!me) return  // wacht op /api/admin/me
    setLoading(true)
    try {
      const params = new URLSearchParams({ recipient: me })
      if (filter === 'unread') params.set('unread', '1')
      const res = await fetch(`/api/admin/inbox?${params.toString()}`)
      const data = await res.json()
      setItems(data.items ?? [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('inbox_me', me)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, filter])

  const unreadCount = useMemo(() => items.filter(i => !i.is_read).length, [items])

  const toggleRead = async (item: InboxItem) => {
    await fetch(`/api/admin/inbox/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: !item.is_read }),
    })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_read: !i.is_read } : i))
  }

  const removeItem = async (item: InboxItem) => {
    if (!confirm('Bericht verwijderen?')) return
    await fetch(`/api/admin/inbox/${item.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const markAllRead = async () => {
    await fetch('/api/admin/inbox/mark-all-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: me }),
    })
    await load()
  }

  const openCompose = (toUser?: string) => {
    setComposeTo(toUser ?? (users.find(u => u !== me) ?? ''))
    setComposeTitle('')
    setComposeBody('')
    setComposeOpen(true)
  }

  const sendMessage = async () => {
    if (!composeTo || !composeTitle.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/admin/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: composeTo,
          sender: me,
          title: composeTitle,
          body: composeBody,
          type: 'message',
        }),
      })
      if (res.ok) {
        setComposeOpen(false)
        alert(`Bericht naar ${composeTo} verstuurd ✓`)
      } else {
        const data = await res.json().catch(() => ({}))
        alert('Verzenden mislukt: ' + (data.error ?? ''))
      }
    } finally { setSending(false) }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">📥 Inbox</h1>
          <p className="text-gravida-sage mt-1 text-sm">
            Berichten en notificaties voor jou. Tag elkaar in taken of stuur een bericht.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <span className="text-xs text-gravida-sage self-center">Ingelogd als <strong>{me || '...'}</strong></span>
          <button onClick={() => openCompose()} className="btn-primary text-sm">+ Nieuw bericht</button>
        </div>
      </div>

      {/* Filter + actions */}
      <div className="card mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          <button onClick={() => setFilter('unread')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${filter === 'unread' ? 'bg-gravida-sage text-white' : 'bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage'}`}>
            Ongelezen ({unreadCount})
          </button>
          <button onClick={() => setFilter('all')}
            className={`text-xs font-medium px-3 py-1.5 rounded-full ${filter === 'all' ? 'bg-gravida-sage text-white' : 'bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage'}`}>
            Alles
          </button>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream hover:border-gravida-sage transition-colors">
            ✓ Markeer alles als gelezen
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="card text-center text-gravida-light-sage text-sm py-12">Laden...</div>
        ) : items.length === 0 ? (
          <div className="card text-center text-gravida-light-sage text-sm py-12">
            {filter === 'unread' ? '🎉 Geen ongelezen berichten — alles is bij!' : 'Nog geen berichten in je inbox.'}
          </div>
        ) : (
          items.map(item => {
            const t = TYPE_INFO[item.type] ?? TYPE_INFO.message
            return (
              <div key={item.id}
                className={`card border-l-4 ${item.is_read ? 'opacity-60' : ''} ${t.bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xl">{t.icon}</span>
                      <h3 className={`font-semibold text-sm ${item.is_read ? 'text-gravida-sage' : 'text-gravida-green'}`}>
                        {item.title}
                      </h3>
                      {!item.is_read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    {item.body && (
                      <p className="text-sm text-gravida-sage whitespace-pre-wrap mb-2">{item.body}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-gravida-light-sage flex-wrap">
                      {item.sender && <span>van <strong>{item.sender}</strong></span>}
                      <span>{formatRelative(item.created_at)}</span>
                      {item.link && (
                        <Link href={item.link} className="text-gravida-sage hover:text-gravida-green underline">
                          Open →
                        </Link>
                      )}
                      {item.related_task_id && (
                        <Link href={`/admin/task-tracker`} className="text-gravida-sage hover:text-gravida-green underline">
                          Taak TT-{String(item.related_task_id).padStart(3, '0')} →
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => toggleRead(item)}
                      className="text-[10px] px-2 py-1 rounded border border-gravida-cream hover:border-gravida-sage whitespace-nowrap"
                      title={item.is_read ? 'Markeer ongelezen' : 'Markeer gelezen'}>
                      {item.is_read ? '○ ongelezen' : '✓ gelezen'}
                    </button>
                    <button onClick={() => removeItem(item)}
                      className="text-[10px] px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50">
                      ✕ verwijder
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <h2 className="text-lg font-bold text-gravida-sage">📤 Nieuw bericht</h2>
              <button onClick={() => setComposeOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center text-gravida-light-sage">✕</button>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="label">Naar</label>
                <select className="input-field" value={composeTo} onChange={e => setComposeTo(e.target.value)}>
                  <option value="">— kies ontvanger —</option>
                  {users.filter(u => u !== me).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Onderwerp *</label>
                <input className="input-field"
                  value={composeTitle} onChange={e => setComposeTitle(e.target.value)}
                  placeholder="Korte titel" />
              </div>
              <div>
                <label className="label">Bericht</label>
                <textarea className="input-field" rows={5}
                  value={composeBody} onChange={e => setComposeBody(e.target.value)}
                  placeholder="Eventueel meer context..." />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="flex-1"></div>
                <button onClick={() => setComposeOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gravida-cream text-gravida-light-sage hover:border-gravida-sage">
                  Annuleren
                </button>
                <button onClick={sendMessage} disabled={sending || !composeTitle.trim()} className="btn-primary">
                  {sending ? 'Verzenden...' : 'Versturen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
