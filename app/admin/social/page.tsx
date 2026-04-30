'use client'

import { useEffect, useState, useCallback } from 'react'

interface SocialPost {
  id: number
  scheduled_for: string
  platform: string
  post_type: string
  category: string | null
  title: string | null
  image_urls: string[]
  caption: string | null
  hashtags: string | null
  status: string
  canva_url: string | null
  internal_notes: string | null
  reminder_sent: boolean
  created_at: string
}

const DUTCH_MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December']
const DUTCH_DAYS_SHORT = ['Ma','Di','Wo','Do','Vr','Za','Zo']
const DUTCH_DAYS_FULL = ['Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag','Zondag']

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', emoji: '📷' },
  { value: 'tiktok',    label: 'TikTok',    emoji: '🎵' },
  { value: 'linkedin',  label: 'LinkedIn',  emoji: '💼' },
  { value: 'facebook',  label: 'Facebook',  emoji: '👥' },
]

// Post types — per type een eigen kleur zodat in 1 oogopslag duidelijk is
// wat voor type post er moet komen op een dag
const POST_TYPES = [
  { value: 'feed',     label: 'Feedpost', emoji: '🟦', rowBg: 'bg-blue-50/60',    badge: 'bg-blue-100 text-blue-800' },
  { value: 'story',    label: 'Story',    emoji: '🟪', rowBg: 'bg-purple-50/60',  badge: 'bg-purple-100 text-purple-800' },
  { value: 'reel',     label: 'Reel',     emoji: '🟧', rowBg: 'bg-orange-50/60',  badge: 'bg-orange-100 text-orange-800' },
  { value: 'carousel', label: 'Carousel', emoji: '🟩', rowBg: 'bg-emerald-50/60', badge: 'bg-emerald-100 text-emerald-800' },
]

// Categories from the previous content planner — drives the rotation/theme of the feed
// Elke categorie heeft een eigen icoon zodat je in de kalender / lijst direct ziet
// wat voor inhoud er staat zonder de tekst te lezen.
const CATEGORIES = [
  { value: 'Beeldjes',     icon: '🤰', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  { value: 'FAQ',          icon: '❓', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { value: 'This or that', icon: '↔️', color: 'bg-sky-50 border-sky-200 text-sky-800' },
  { value: 'Atelier',      icon: '🎨', color: 'bg-rose-50 border-rose-200 text-rose-800' },
  { value: 'Bedels',       icon: '✨', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
  { value: 'Review',       icon: '💬', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { value: 'Algemeen',     icon: '📣', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  { value: 'Promotie',     icon: '🎁', color: 'bg-pink-50 border-pink-200 text-pink-800' },
]

const STATUSES = [
  { value: 'draft',      label: 'Concept',     color: 'bg-gray-100 text-gray-600' },
  { value: 'klaargezet', label: 'Klaargezet',  color: 'bg-blue-100 text-blue-700' },
  { value: 'geplaatst',  label: 'Geplaatst',   color: 'bg-green-100 text-green-700' },
  { value: 'gemist',     label: 'Gemist',      color: 'bg-red-100 text-red-700' },
  // Backwards compatibility for existing rows with the old 'scheduled' status
  { value: 'scheduled',  label: 'Klaargezet',  color: 'bg-blue-100 text-blue-700' },
  { value: 'posted',     label: 'Geplaatst',   color: 'bg-green-100 text-green-700' },
  { value: 'missed',     label: 'Gemist',      color: 'bg-red-100 text-red-700' },
]

function pad(n: number) { return String(n).padStart(2, '0') }
function isoLocalDateTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY_FORM: Partial<SocialPost> & { scheduled_for_local?: string; image_urls_text?: string } = {
  platform: 'instagram',
  post_type: 'feed',
  category: '',
  title: '',
  caption: '',
  hashtags: '',
  status: 'draft',
  canva_url: '',
  internal_notes: '',
  image_urls: [],
  image_urls_text: '',
}

export default function SocialPlannerPage() {
  const today = new Date()
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterCategory, setFilterCategory] = useState('alle')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const monthStart = new Date(calYear, calMonth, 1)
  const monthEnd = new Date(calYear, calMonth + 1, 0, 23, 59, 59)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const fromD = new Date(monthStart); fromD.setDate(fromD.getDate() - 7)
      const toD = new Date(monthEnd); toD.setDate(toD.getDate() + 7)
      const res = await fetch(`/api/admin/social-posts?from=${fromD.toISOString()}&to=${toD.toISOString()}`)
      if (res.ok) {
        const data = await res.json()
        setPosts(data.posts ?? [])
      }
    } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calYear, calMonth])

  useEffect(() => { load() }, [load])

  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }

  // Filter posts by selected category
  const filteredPosts = filterCategory === 'alle'
    ? posts
    : posts.filter(p => p.category === filterCategory)

  // Build calendar grid
  const firstDow = (monthStart.getDay() + 6) % 7
  const gridStart = new Date(monthStart); gridStart.setDate(gridStart.getDate() - firstDow)
  const gridDays: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i)
    gridDays.push(d)
  }

  // Group posts by date for calendar
  const postsByDate = new Map<string, SocialPost[]>()
  for (const p of filteredPosts) {
    const d = new Date(p.scheduled_for)
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    const arr = postsByDate.get(key) ?? []
    arr.push(p)
    postsByDate.set(key, arr)
  }

  // Group posts by date for list view (only posts in the current month)
  const monthPosts = filteredPosts
    .filter(p => {
      const d = new Date(p.scheduled_for)
      return d.getFullYear() === calYear && d.getMonth() === calMonth
    })
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))

  const monthPostsByDate = new Map<string, SocialPost[]>()
  for (const p of monthPosts) {
    const d = new Date(p.scheduled_for)
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    const arr = monthPostsByDate.get(key) ?? []
    arr.push(p)
    monthPostsByDate.set(key, arr)
  }

  const openNewModal = (date?: Date, presetCategory?: string) => {
    const d = date ?? new Date()
    d.setHours(10, 0, 0, 0)
    setEditingPost(null)
    setForm({
      ...EMPTY_FORM,
      scheduled_for_local: isoLocalDateTime(d),
      image_urls: [],
      image_urls_text: '',
      category: presetCategory ?? '',
    })
    setError(''); setUploadError('')
    setModalOpen(true)
  }

  const openEditModal = (post: SocialPost) => {
    setEditingPost(post)
    setForm({
      ...post,
      scheduled_for_local: isoLocalDateTime(new Date(post.scheduled_for)),
      image_urls_text: (post.image_urls ?? []).join('\n'),
    })
    setError(''); setUploadError('')
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.scheduled_for_local) { setError('Datum + tijd is verplicht'); return }
    setSaving(true); setError('')
    try {
      const image_urls = (form.image_urls_text ?? '').split('\n').map(s => s.trim()).filter(Boolean)
      const payload = {
        scheduled_for: new Date(form.scheduled_for_local).toISOString(),
        platform: form.platform,
        post_type: form.post_type,
        category: form.category || null,
        title: form.title || null,
        image_urls,
        caption: form.caption || null,
        hashtags: form.hashtags || null,
        status: form.status,
        canva_url: form.canva_url || null,
        internal_notes: form.internal_notes || null,
      }
      const url = editingPost ? `/api/admin/social-posts/${editingPost.id}` : '/api/admin/social-posts'
      const method = editingPost ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) {
        setModalOpen(false)
        await load()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Opslaan mislukt')
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!editingPost) return
    if (!confirm('Deze post echt verwijderen?')) return
    const res = await fetch(`/api/admin/social-posts/${editingPost.id}`, { method: 'DELETE' })
    if (res.ok) { setModalOpen(false); await load() }
  }

  // Quick toggle status (klaargezet ↔ geplaatst, with cycle)
  const cycleStatus = async (post: SocialPost) => {
    const order = ['draft', 'klaargezet', 'geplaatst', 'gemist']
    const current = order.includes(post.status) ? post.status : 'draft'
    const next = order[(order.indexOf(current) + 1) % order.length]
    const res = await fetch(`/api/admin/social-posts/${post.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: next } : p))
    }
  }

  const generateTemplate = async () => {
    if (!confirm(
      `Standaard contentplanning genereren voor ${DUTCH_MONTHS[calMonth]} ${calYear}?\n\n` +
      `Dit voegt het wekelijkse ritme toe (Beeldjes, FAQ, Atelier, This or that, Bedels, Review, Algemeen). ` +
      `Bestaande posts blijven staan; alleen lege slots worden gevuld.\n\n` +
      `Status: alle posts krijgen 'concept' — vul daarna titels en beelden in.`
    )) return
    const res = await fetch('/api/admin/social-posts/generate-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: calYear, month: calMonth }),
    })
    const data = await res.json()
    if (res.ok) {
      alert(`${data.inserted} posts toegevoegd voor ${DUTCH_MONTHS[calMonth]} ${calYear}.`)
      await load()
    } else {
      alert(data.error ?? 'Genereren mislukt')
    }
  }

  const platformInfo = (p: string) => PLATFORMS.find(x => x.value === p) ?? PLATFORMS[0]
  const statusInfo = (s: string) => STATUSES.find(x => x.value === s) ?? STATUSES[0]
  const categoryInfo = (c: string | null) => CATEGORIES.find(x => x.value === c) ?? null
  const typeInfo = (t: string) => POST_TYPES.find(x => x.value === t) ?? POST_TYPES[0]

  const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Social media planner</h1>
          <p className="text-gravida-sage mt-1 text-sm">Plan je posts per categorie en houd het overzicht. Klik op een dag om toe te voegen.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={generateTemplate} className="btn-secondary"
            title="Genereer een standaard wekelijks ritme voor deze maand (Beeldjes, FAQ, Atelier, etc.)">
            ✨ Plan deze maand
          </button>
          <button onClick={() => openNewModal()} className="btn-primary">+ Nieuwe post</button>
        </div>
      </div>

      {/* Toolbar: month nav + view toggle + category filter */}
      <div className="card mb-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">‹</button>
          <h2 className="section-title min-w-[140px] text-center">{DUTCH_MONTHS[calMonth]} {calYear}</h2>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">›</button>
        </div>

        <div className="sm:ml-auto flex flex-wrap items-center gap-2">
          <select className="input-field text-sm py-1.5" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="alle">Alle categorieën</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
          </select>

          <div className="inline-flex rounded-lg border border-gravida-cream overflow-hidden">
            <button onClick={() => setView('calendar')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'calendar' ? 'bg-gravida-sage text-white' : 'bg-white text-gravida-sage hover:bg-gravida-cream'}`}>
              📅 Kalender
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'list' ? 'bg-gravida-sage text-white' : 'bg-white text-gravida-sage hover:bg-gravida-cream'}`}>
              ☰ Lijst
            </button>
          </div>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <div className="card overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DUTCH_DAYS_SHORT.map(d => <div key={d} className="text-center text-xs text-gravida-light-sage font-medium py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {gridDays.map(d => {
              const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
              const inMonth = d.getMonth() === calMonth
              const isToday = key === todayKey
              const dayPosts = (postsByDate.get(key) ?? []).sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
              return (
                <div key={key}
                  onClick={() => openNewModal(d)}
                  className={`relative min-h-[90px] sm:min-h-[110px] rounded-xl p-1.5 sm:p-2 cursor-pointer transition-all border-2 ${
                    isToday ? 'border-gravida-sage' : 'border-transparent'
                  } ${inMonth ? 'bg-white hover:bg-gravida-off-white' : 'bg-gravida-cream/30 opacity-60'}`}
                >
                  <div className={`text-xs sm:text-sm font-semibold mb-1 ${isToday ? 'text-gravida-sage' : inMonth ? 'text-gravida-green' : 'text-gravida-light-sage'}`}>
                    {d.getDate()}
                  </div>
                  <div className="flex flex-col gap-1">
                    {dayPosts.slice(0, 3).map(p => {
                      const t = new Date(p.scheduled_for)
                      const time = `${pad(t.getHours())}:${pad(t.getMinutes())}`
                      const thumb = p.image_urls?.[0]
                      const ti = typeInfo(p.post_type)
                      const ci = categoryInfo(p.category)
                      return (
                        <button key={p.id} onClick={(e) => { e.stopPropagation(); openEditModal(p) }}
                          className={`flex items-center gap-1 sm:gap-1.5 px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] hover:opacity-80 transition-opacity overflow-hidden ${ti.badge}`}
                          title={`${time} · ${ti.label} · ${p.category ?? ''} · ${p.title ?? p.caption?.slice(0, 40) ?? ''}`}
                        >
                          {thumb ? (
                            <img src={thumb} alt="" className="w-4 h-4 sm:w-5 sm:h-5 rounded object-cover shrink-0" />
                          ) : (
                            <span className="text-[10px] sm:text-xs">{ci?.icon ?? ti.emoji}</span>
                          )}
                          <span className="truncate">{time}{p.title ? ` · ${p.title.slice(0,15)}` : p.category ? ` · ${p.category.slice(0,12)}` : ''}</span>
                        </button>
                      )
                    })}
                    {dayPosts.length > 3 && (
                      <button onClick={(e) => { e.stopPropagation(); openEditModal(dayPosts[3]) }}
                        className="text-[9px] sm:text-[10px] text-gravida-sage hover:text-gravida-green">
                        + {dayPosts.length - 3} meer
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {loading && <p className="text-center text-gravida-light-sage text-sm mt-4">Laden...</p>}
        </div>
      )}

      {/* List view (à la spreadsheet) */}
      {view === 'list' && (
        <div className="card overflow-x-auto p-0">
          {loading ? (
            <div className="p-12 text-center text-gravida-light-sage text-sm">Laden...</div>
          ) : monthPosts.length === 0 ? (
            <div className="p-12 text-center text-gravida-light-sage text-sm">Geen posts ingepland in deze maand. Klik &quot;+ Nieuwe post&quot;.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gravida-cream/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap w-24">Dag</th>
                  <th className="text-left px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap w-32">Categorie</th>
                  <th className="text-left px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap w-24">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-gravida-light-sage">Titel / omschrijving</th>
                  <th className="text-left px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap w-28">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap w-16"></th>
                </tr>
              </thead>
              <tbody>
                {Array.from(monthPostsByDate.entries()).map(([dateKey, dayPosts], dayIdx) => {
                  const d = new Date(dateKey + 'T00:00:00')
                  const dow = (d.getDay() + 6) % 7
                  const dayLabel = `${DUTCH_DAYS_FULL[dow].slice(0, 2)} - ${d.getDate()}`
                  return dayPosts.map((p, postIdx) => {
                    const cat = categoryInfo(p.category)
                    const ti = typeInfo(p.post_type)
                    const time = `${pad(new Date(p.scheduled_for).getHours())}:${pad(new Date(p.scheduled_for).getMinutes())}`
                    const isFirstOfDay = postIdx === 0
                    return (
                      <tr key={p.id} className={`border-t border-gravida-cream hover:opacity-80 transition-opacity ${ti.rowBg}`}>
                        <td className="px-3 py-2 align-top whitespace-nowrap text-gravida-sage">
                          {isFirstOfDay && <div className="font-medium">{dayLabel}</div>}
                          <div className="text-xs text-gravida-light-sage">{time}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          {p.category ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cat?.color ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                              {cat?.icon && <span>{cat.icon}</span>}
                              <span>{p.category}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gravida-light-sage italic">geen</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top whitespace-nowrap text-xs">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${ti.badge}`}>
                            <span>{ti.emoji}</span>
                            <span>{ti.label}</span>
                          </span>
                          <div className="text-[10px] text-gravida-light-sage mt-0.5">{platformInfo(p.platform).emoji} {platformInfo(p.platform).label}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button onClick={() => openEditModal(p)} className="text-left hover:underline">
                            <div className="font-medium">{p.title || <span className="italic text-gravida-light-sage">geen titel</span>}</div>
                            {p.caption && <div className="text-xs text-gravida-light-sage line-clamp-1">{p.caption}</div>}
                          </button>
                          {p.canva_url && (
                            <a href={p.canva_url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-gravida-sage hover:text-gravida-green inline-block mt-0.5"
                              onClick={e => e.stopPropagation()}>
                              🎨 Canva →
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            onClick={() => cycleStatus(p)}
                            className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer outline-none whitespace-nowrap hover:opacity-80 ${statusInfo(p.status).color}`}
                            title="Klik om status te wijzigen"
                          >
                            {statusInfo(p.status).label}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button onClick={() => openEditModal(p)} className="text-gravida-sage hover:text-gravida-green text-xs underline">Bewerk</button>
                        </td>
                      </tr>
                    )
                  })
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Note about insights */}
      <div className="mt-6 text-xs text-gravida-light-sage italic">
        💡 Statistieken over wanneer je volgers het meest actief zijn komen via Instagram Insights — dat vereist Instagram Graph API koppeling (fase 2).
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <h2 className="text-lg font-bold text-gravida-sage">
                {editingPost ? 'Post bewerken' : 'Nieuwe post inplannen'}
              </h2>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">Datum &amp; tijd *</label>
                  <input type="datetime-local" className="input-field"
                    value={form.scheduled_for_local ?? ''}
                    onChange={e => setForm(f => ({ ...f, scheduled_for_local: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label">Categorie</label>
                  <select className="input-field" value={form.category ?? ''}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="">— geen —</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.value}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Platform</label>
                  <select className="input-field" value={form.platform ?? 'instagram'}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
                    {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Type</label>
                  <select className="input-field" value={form.post_type ?? 'feed'}
                    onChange={e => setForm(f => ({ ...f, post_type: e.target.value }))}>
                    {POST_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Status</label>
                  <select className="input-field" value={form.status ?? 'draft'}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="draft">Concept</option>
                    <option value="klaargezet">Klaargezet</option>
                    <option value="geplaatst">Geplaatst</option>
                    <option value="gemist">Gemist</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Titel / omschrijving</label>
                  <input className="input-field" placeholder="bijv. MB9 - zwart, of: Wat is een 3D scan"
                    value={form.title ?? ''}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label flex items-center justify-between">
                    <span>Media — afbeeldingen of video&apos;s</span>
                    <span className="text-[10px] font-normal text-gravida-light-sage">
                      {uploading ? 'Uploaden...' : 'Upload of plak URL'}
                    </span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <label className={`flex-1 cursor-pointer text-center py-2 px-4 rounded-lg border-2 border-dashed border-gravida-cream hover:border-gravida-sage transition-colors text-xs ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      📎 Bestand kiezen (jpg/png/mp4)
                      <input type="file" className="hidden"
                        accept="image/*,video/*"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? [])
                          if (files.length === 0) return
                          setUploading(true); setUploadError('')
                          const newUrls: string[] = []
                          for (const file of files) {
                            const fd = new FormData()
                            fd.append('file', file)
                            try {
                              const res = await fetch('/api/admin/social-posts/upload', {
                                method: 'POST',
                                body: fd,
                              })
                              const data = await res.json()
                              if (res.ok && data.url) {
                                newUrls.push(data.url)
                              } else {
                                setUploadError(data.error ?? `Upload mislukt: ${file.name}`)
                              }
                            } catch {
                              setUploadError(`Verbindingsfout bij ${file.name}`)
                            }
                          }
                          if (newUrls.length > 0) {
                            const existing = form.image_urls_text ?? ''
                            const combined = (existing.trim() + '\n' + newUrls.join('\n')).trim()
                            setForm(f => ({ ...f, image_urls_text: combined }))
                          }
                          setUploading(false)
                          // reset input so same file can be picked again
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                  {uploadError && <p className="text-red-600 text-[11px] mb-2">{uploadError}</p>}
                  <textarea rows={2} className="input-field font-mono text-xs"
                    placeholder="https://... (één URL per regel)"
                    value={form.image_urls_text ?? ''}
                    onChange={e => setForm(f => ({ ...f, image_urls_text: e.target.value }))}
                  />
                  {form.image_urls_text && form.image_urls_text.trim() && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {form.image_urls_text.split('\n').map(s => s.trim()).filter(Boolean).map((url, i) => {
                        const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url)
                        return isVideo ? (
                          <video key={i} src={url} muted playsInline
                            className="w-16 h-16 rounded-lg object-cover border border-gravida-cream shrink-0 bg-black"
                          />
                        ) : (
                          <img key={i} src={url} alt={`preview ${i+1}`}
                            className="w-16 h-16 rounded-lg object-cover border border-gravida-cream shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                          />
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Canva link (optioneel)</label>
                  <input className="input-field" placeholder="https://www.canva.com/design/..."
                    value={form.canva_url ?? ''}
                    onChange={e => setForm(f => ({ ...f, canva_url: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Caption</label>
                  <textarea rows={4} className="input-field"
                    placeholder="Schrijf je caption..."
                    value={form.caption ?? ''}
                    onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Hashtags</label>
                  <textarea rows={2} className="input-field"
                    placeholder="#zwangerschap #3dscan #gravida"
                    value={form.hashtags ?? ''}
                    onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Interne notities</label>
                  <textarea rows={2} className="input-field"
                    value={form.internal_notes ?? ''}
                    onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                  />
                </div>
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div className="flex gap-2 pt-2">
                {editingPost && (
                  <button onClick={handleDelete}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                    Verwijderen
                  </button>
                )}
                <div className="flex-1"></div>
                <button onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-gravida-cream text-gravida-light-sage hover:border-gravida-sage transition-colors">
                  Annuleren
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Opslaan...' : editingPost ? 'Opslaan' : 'Inplannen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
