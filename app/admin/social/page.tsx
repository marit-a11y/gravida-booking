'use client'

import { useEffect, useState, useCallback } from 'react'

interface SocialPost {
  id: number
  scheduled_for: string
  platform: string
  post_type: string
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

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', emoji: '📷' },
  { value: 'tiktok',    label: 'TikTok',    emoji: '🎵' },
  { value: 'linkedin',  label: 'LinkedIn',  emoji: '💼' },
  { value: 'facebook',  label: 'Facebook',  emoji: '👥' },
]

const POST_TYPES = [
  { value: 'feed',     label: 'Feed post' },
  { value: 'story',    label: 'Story' },
  { value: 'reel',     label: 'Reel / Video' },
  { value: 'carousel', label: 'Carousel' },
]

const STATUSES = [
  { value: 'draft',     label: 'Concept',     color: 'bg-gray-100 text-gray-600' },
  { value: 'scheduled', label: 'Ingepland',   color: 'bg-blue-100 text-blue-700' },
  { value: 'posted',    label: 'Geplaatst',   color: 'bg-green-100 text-green-700' },
  { value: 'missed',    label: 'Gemist',      color: 'bg-red-100 text-red-700' },
]

function pad(n: number) { return String(n).padStart(2, '0') }
function isoLocalDateTime(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const EMPTY_FORM: Partial<SocialPost> & { scheduled_for_local?: string; image_urls_text?: string } = {
  platform: 'instagram',
  post_type: 'feed',
  caption: '',
  hashtags: '',
  status: 'scheduled',
  canva_url: '',
  internal_notes: '',
  image_urls: [],
  image_urls_text: '',
}

export default function SocialPlannerPage() {
  const today = new Date()
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null)
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const monthStart = new Date(calYear, calMonth, 1)
  const monthEnd = new Date(calYear, calMonth + 1, 0, 23, 59, 59)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch posts for the visible month + a buffer of 7 days on each side
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

  // Build calendar grid: 6 weeks worth of days, starting at Monday before/on month start
  const firstDow = (monthStart.getDay() + 6) % 7 // 0=Mon … 6=Sun
  const gridStart = new Date(monthStart); gridStart.setDate(gridStart.getDate() - firstDow)
  const gridDays: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart); d.setDate(gridStart.getDate() + i)
    gridDays.push(d)
  }

  // Group posts by ISO date
  const postsByDate = new Map<string, SocialPost[]>()
  for (const p of posts) {
    const d = new Date(p.scheduled_for)
    const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
    const arr = postsByDate.get(key) ?? []
    arr.push(p)
    postsByDate.set(key, arr)
  }

  const openNewModal = (date?: Date) => {
    const d = date ?? new Date()
    if (!date) { d.setHours(10, 0, 0, 0) } else { d.setHours(10, 0, 0, 0) }
    setEditingPost(null)
    setForm({ ...EMPTY_FORM, scheduled_for_local: isoLocalDateTime(d), image_urls: [], image_urls_text: '' })
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (post: SocialPost) => {
    setEditingPost(post)
    setForm({
      ...post,
      scheduled_for_local: isoLocalDateTime(new Date(post.scheduled_for)),
      image_urls_text: (post.image_urls ?? []).join('\n'),
    })
    setError('')
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

  const platformInfo = (p: string) => PLATFORMS.find(x => x.value === p) ?? PLATFORMS[0]
  const statusInfo = (s: string) => STATUSES.find(x => x.value === s) ?? STATUSES[0]

  const todayKey = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Social media planner</h1>
          <p className="text-gravida-sage mt-1 text-sm">Plan posts in voor Instagram, TikTok en meer. Klik op een dag om toe te voegen.</p>
        </div>
        <button onClick={() => openNewModal()} className="btn-primary shrink-0">+ Nieuwe post</button>
      </div>

      {/* Calendar */}
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">‹</button>
          <h2 className="section-title">{DUTCH_MONTHS[calMonth]} {calYear}</h2>
          <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-gravida-cream flex items-center justify-center text-lg">›</button>
        </div>

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
                    return (
                      <button key={p.id} onClick={(e) => { e.stopPropagation(); openEditModal(p) }}
                        className={`flex items-center gap-1 sm:gap-1.5 px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] hover:opacity-80 transition-opacity overflow-hidden ${statusInfo(p.status).color}`}
                        title={`${time} · ${platformInfo(p.platform).label} · ${p.caption?.slice(0, 40) ?? ''}`}
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="w-4 h-4 sm:w-5 sm:h-5 rounded object-cover shrink-0" />
                        ) : (
                          <span className="text-[10px] sm:text-xs">{platformInfo(p.platform).emoji}</span>
                        )}
                        <span className="truncate">{time}</span>
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
                <div className="sm:col-span-2">
                  <label className="label">Afbeelding URL(s) — 1 per regel</label>
                  <textarea rows={2} className="input-field font-mono text-xs"
                    placeholder="https://..."
                    value={form.image_urls_text ?? ''}
                    onChange={e => setForm(f => ({ ...f, image_urls_text: e.target.value }))}
                  />
                  {form.image_urls_text && form.image_urls_text.trim() && (
                    <div className="flex gap-2 mt-2 overflow-x-auto">
                      {form.image_urls_text.split('\n').map(s => s.trim()).filter(Boolean).map((url, i) => (
                        <img key={i} src={url} alt={`preview ${i+1}`}
                          className="w-16 h-16 rounded-lg object-cover border border-gravida-cream shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                        />
                      ))}
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
                  <label className="label">Status</label>
                  <select className="input-field" value={form.status ?? 'scheduled'}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
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
