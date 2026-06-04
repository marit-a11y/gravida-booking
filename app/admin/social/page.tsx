'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getEventsForMonth, getEventForDate, CONTENT_IDEAS, type ThemeEvent, type CategoryIdea } from '@/lib/social-themes'
import { nlLocalToIso, isoToNlLocal, formatNlTime, getNlDateKey, getNlHourMinute } from '@/lib/nl-time'
import MediaLibraryPicker from '@/app/admin/components/MediaLibraryPicker'

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
// Tijd in NL terugbouwen naar "YYYY-MM-DDTHH:MM" voor het datetime-local input.
// We gebruiken altijd Europe/Amsterdam, niet de browser-tijdzone, zodat een
// post om 20:00 ook echt 20:00 NL is — ook als je in het buitenland inlogt.
function isoLocalDateTime(d: Date) {
  return isoToNlLocal(d)
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

export default function SocialPlannerPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gravida-light-sage">Laden...</div>}>
      <SocialPlannerPage />
    </Suspense>
  )
}

function SocialPlannerPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const deepLinkPostId = searchParams.get('post')
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
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)
  const [copyToPostId, setCopyToPostId] = useState<number | null>(null)
  const [copyToDate, setCopyToDate] = useState('')
  const [copying, setCopying] = useState(false)

  const duplicatePost = async (sourcePost: SocialPost, newDateIso: string) => {
    setCopying(true)
    try {
      // Behoud het oorspronkelijke tijdstip op de nieuwe datum
      const old = new Date(sourcePost.scheduled_for)
      const targetDate = new Date(newDateIso + 'T00:00:00')
      targetDate.setHours(old.getHours(), old.getMinutes(), 0, 0)

      const payload = {
        scheduled_for: targetDate.toISOString(),
        platform: sourcePost.platform,
        post_type: sourcePost.post_type,
        category: sourcePost.category,
        title: sourcePost.title,
        image_urls: sourcePost.image_urls ?? [],
        caption: sourcePost.caption,
        hashtags: sourcePost.hashtags,
        canva_url: sourcePost.canva_url,
        internal_notes: sourcePost.internal_notes,
        status: 'draft',  // kopie start als draft (autoBump pakt klaargezet als compleet)
      }
      const r = await fetch('/api/admin/social-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.ok) {
        setCopyToPostId(null)
        setCopyToDate('')
        await load()
      } else {
        const d = await r.json().catch(() => ({}))
        alert('Kopiëren mislukt: ' + (d.error ?? r.status))
      }
    } finally { setCopying(false) }
  }
  // Ideeen-modal (statische lijst per categorie)
  const [ideasModalOpen, setIdeasModalOpen] = useState(false)
  const [ideasCategory, setIdeasCategory] = useState<string>('Beeldjes')
  // Legenda + bulk-delete
  const [legendOpen, setLegendOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleteFilter, setBulkDeleteFilter] = useState<'all' | 'draft' | 'klaargezet' | 'geplaatst' | 'gemist'>('draft')
  const [bulkOnlyEmpty, setBulkOnlyEmpty] = useState(true)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  // AI ideeen state (binnen het edit-modal)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiIdeas, setAiIdeas] = useState<Array<{
    title: string; caption: string; hashtags: string; post_type: string; reasoning?: string
  }>>([])
  const [aiCustomContext, setAiCustomContext] = useState('')
  const [aiContextOpen, setAiContextOpen] = useState(false)

  // Events (feestdagen / themadagen) voor zichtbare maand + buffer
  const monthEvents = useMemo(() => {
    // Pak events voor zichtbare maand én buurmaanden (kalender-grid loopt over)
    const all: ThemeEvent[] = []
    for (let offset = -1; offset <= 1; offset++) {
      let y = calYear, m = calMonth + offset
      if (m < 0) { m += 12; y -= 1 }
      if (m > 11) { m -= 12; y += 1 }
      all.push(...getEventsForMonth(y, m))
    }
    return all
  }, [calYear, calMonth])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ThemeEvent[]>()
    for (const e of monthEvents) {
      const arr = map.get(e.date) ?? []
      arr.push(e)
      map.set(e.date, arr)
    }
    return map
  }, [monthEvents])

  // Aankomende belangrijke data binnen 60 dagen (vanaf vandaag)
  const upcomingEvents = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const window = new Date(now); window.setDate(window.getDate() + 60)
    // Pak events voor dit + volgend jaar zodat einde-jaar werkt
    const all: ThemeEvent[] = []
    for (let yr = now.getFullYear(); yr <= now.getFullYear() + 1; yr++) {
      for (let m = 0; m < 12; m++) all.push(...getEventsForMonth(yr, m))
    }
    return all
      .filter(e => {
        const d = new Date(e.date + 'T00:00:00')
        return d >= now && d <= window
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12)
  }, [])

  const [upcomingOpen, setUpcomingOpen] = useState(true)

  const jumpToDate = (dateStr: string) => {
    const [y, m] = dateStr.split('-').map(Number)
    setCalYear(y)
    setCalMonth(m - 1)
  }

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

  // Deep link: open de specifieke post als ?post=ID in de URL staat.
  // Wacht tot posts geladen zijn, dan open modal en strip ?post= uit URL.
  useEffect(() => {
    if (!deepLinkPostId || loading) return
    const id = parseInt(deepLinkPostId, 10)
    if (isNaN(id)) return
    const post = posts.find(p => p.id === id)
    if (post) {
      openEditModal(post)
      // Schoon de URL op zodat refresh niet opnieuw triggert
      router.replace('/admin/social', { scroll: false })
    } else {
      // Post niet gevonden in zichtbare maand → fetch 'm direct
      fetch(`/api/admin/social-posts/${id}`).then(r => r.ok ? r.json() : null).then(data => {
        if (data?.post) {
          // Spring naar de juiste maand
          const d = new Date(data.post.scheduled_for)
          setCalYear(d.getFullYear())
          setCalMonth(d.getMonth())
          openEditModal(data.post)
          router.replace('/admin/social', { scroll: false })
        }
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkPostId, loading, posts])

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

  // Group posts by date for calendar — gebruik NL-tijd, niet browser-tijd
  const postsByDate = new Map<string, SocialPost[]>()
  for (const p of filteredPosts) {
    const key = getNlDateKey(p.scheduled_for)
    const arr = postsByDate.get(key) ?? []
    arr.push(p)
    postsByDate.set(key, arr)
  }

  // Group posts by date for list view (only posts in the current month) — NL tijd
  const monthPosts = filteredPosts
    .filter(p => {
      const key = getNlDateKey(p.scheduled_for)  // "YYYY-MM-DD"
      const [y, m] = key.split('-').map(Number)
      return y === calYear && m - 1 === calMonth
    })
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))

  const monthPostsByDate = new Map<string, SocialPost[]>()
  for (const p of monthPosts) {
    const key = getNlDateKey(p.scheduled_for)
    const arr = monthPostsByDate.get(key) ?? []
    arr.push(p)
    monthPostsByDate.set(key, arr)
  }

  const openNewModal = (date?: Date, presetCategory?: string) => {
    // Bouw de default datetime-local string in NL-tijd (10:00).
    // Als er een date is doorgegeven (uit kalender-grid), pak Y/M/D direct.
    // Anders: vandaag in NL-datum.
    const dateKey = date
      ? `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
      : getNlDateKey(new Date())
    setEditingPost(null)
    setForm({
      ...EMPTY_FORM,
      scheduled_for_local: `${dateKey}T10:00`,
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
        // Interpreteer de gekozen datum/tijd ALTIJD als Europe/Amsterdam,
        // ongeacht waar de gebruiker zich bevindt
        scheduled_for: nlLocalToIso(form.scheduled_for_local),
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

  // ── AI ideeen genereren (binnen edit-modal) ─────────────────────────────
  const generateAiIdeas = async (mode: 'ideas' | 'caption' | 'custom') => {
    setAiLoading(true); setAiError(''); setAiIdeas([])
    try {
      const date = form.scheduled_for_local
        ? form.scheduled_for_local.slice(0, 10)
        : undefined
      const res = await fetch('/api/admin/social-posts/ai-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          category: form.category || null,
          post_type: form.post_type || 'feed',
          date,
          title: mode === 'caption' ? form.title : undefined,
          custom_context: aiCustomContext.trim() || undefined,
          count: 5,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAiError(data.error ?? 'AI request mislukt')
      } else {
        setAiIdeas(data.ideas ?? [])
      }
    } catch (err) {
      setAiError('Verbindingsfout: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAiLoading(false)
    }
  }

  const applyAiIdea = (idea: { title: string; caption: string; hashtags: string; post_type: string }) => {
    setForm(f => ({
      ...f,
      title: idea.title,
      caption: idea.caption,
      hashtags: idea.hashtags,
      post_type: (['feed','story','reel','carousel'].includes(idea.post_type) ? idea.post_type : f.post_type) as string,
    }))
    setAiIdeas([])  // verberg lijst na keuze
  }

  // Vanaf categorie-idee een nieuwe post-modal openen
  const useCategoryIdea = (idea: CategoryIdea, category: string) => {
    setEditingPost(null)
    setForm({
      ...EMPTY_FORM,
      // Default: vandaag (NL) om 10:00
      scheduled_for_local: `${getNlDateKey(new Date())}T10:00`,
      image_urls: [],
      image_urls_text: '',
      category,
      post_type: idea.bestType ?? 'feed',
      title: idea.title,
      internal_notes: idea.description,
    })
    setIdeasModalOpen(false)
    setError(''); setUploadError('')
    setModalOpen(true)
  }

  // Bulk delete posts in zichtbare maand
  const handleBulkDelete = async () => {
    const monthLabel = `${DUTCH_MONTHS[calMonth]} ${calYear}`
    const statusLabel = bulkDeleteFilter === 'all'
      ? 'ALLE posts'
      : `posts met status "${bulkDeleteFilter}"`
    const emptyLabel = bulkOnlyEmpty ? ' (alleen zonder titel/caption/media)' : ''
    if (!confirm(`Weet je zeker dat je ${statusLabel}${emptyLabel} in ${monthLabel} wilt verwijderen?\n\nDit kan niet ongedaan gemaakt worden.`)) return

    setBulkDeleting(true)
    try {
      const from = new Date(calYear, calMonth, 1).toISOString()
      const to = new Date(calYear, calMonth + 1, 0, 23, 59, 59).toISOString()
      const res = await fetch('/api/admin/social-posts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from, to,
          status: bulkDeleteFilter,
          only_empty: bulkOnlyEmpty,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        alert(`${data.deleted} posts verwijderd uit ${monthLabel}.`)
        setBulkDeleteOpen(false)
        await load()
      } else {
        alert(data.error ?? 'Verwijderen mislukt')
      }
    } finally {
      setBulkDeleting(false)
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
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={() => setLegendOpen(o => !o)} className="btn-secondary"
            title="Toon uitleg van kleuren en symbolen">
            {legendOpen ? '✕ Legenda' : 'ℹ️ Legenda'}
          </button>
          <button onClick={() => setIdeasModalOpen(true)} className="btn-secondary"
            title="Bekijk content-ideeën per categorie">
            💡 Ideeën
          </button>
          <button onClick={generateTemplate} className="btn-secondary"
            title="Genereer een standaard wekelijks ritme voor deze maand (Beeldjes, FAQ, Atelier, etc.)">
            ✨ Plan deze maand
          </button>
          <button onClick={() => setBulkDeleteOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            title="Verwijder posts uit deze maand">
            🗑️ Wis maand
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

      {/* Legenda */}
      {legendOpen && (
        <div className="card mb-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <p className="font-semibold text-gravida-green mb-2">Post-types (rij-kleur)</p>
              <div className="space-y-1.5">
                {POST_TYPES.map(t => (
                  <div key={t.value} className="flex items-center gap-2">
                    <span className={`inline-block w-4 h-4 rounded ${t.rowBg.replace('/60', '')} border border-gravida-cream`}></span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${t.badge}`}>
                      <span>{t.emoji}</span><span>{t.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-gravida-green mb-2">Categorieën (icoon)</p>
              <div className="grid grid-cols-2 gap-1">
                {CATEGORIES.map(c => (
                  <span key={c.value} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] ${c.color}`}>
                    <span>{c.icon}</span><span>{c.value}</span>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="font-semibold text-gravida-green mb-2">Status</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px]">Concept</span>
                  <span className="text-gravida-light-sage">— nog uitwerken</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px]">⏱ Klaargezet</span>
                  <span className="text-gravida-light-sage">— klaar om te plaatsen</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px]">✓ Geplaatst</span>
                  <span className="text-gravida-light-sage">— online</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[11px]">Gemist</span>
                  <span className="text-gravida-light-sage">— niet geplaatst</span>
                </div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-gravida-green mb-2">Themadagen / feestdagen</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-pink-50/60 border border-pink-200"></span>
                  <span>Commerciële dag (Moederdag, Valentijn, Sinterklaas, ...)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded bg-amber-50/60 border border-amber-200"></span>
                  <span>Themadag / feestdag</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💐 👑 🎄</span>
                  <span>Emoji-badge in hoek = themadag (hover voor uitleg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-4 h-4 rounded border-2 border-gravida-sage"></span>
                  <span>Vandaag</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vandaag posten — quick access voor mobiel */}
      {(() => {
        const todayPosts = posts.filter(p => getNlDateKey(p.scheduled_for) === todayKey)
        if (todayPosts.length === 0) return null
        const sorted = [...todayPosts].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
        return (
          <div className="card mb-6 border-l-4 border-pink-400 bg-pink-50/30">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-pink-700">
                📌 Vandaag posten ({todayPosts.length})
              </h2>
            </div>
            <div className="space-y-2">
              {sorted.map(p => {
                const ci = categoryInfo(p.category)
                const ti = typeInfo(p.post_type)
                const time = formatNlTime(p.scheduled_for)
                const isPosted = p.status === 'geplaatst' || p.status === 'posted'
                return (
                  <button key={p.id} onClick={() => openEditModal(p)}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      isPosted
                        ? 'bg-green-50 border-green-200 opacity-60'
                        : 'bg-white border-gravida-cream hover:border-gravida-sage'
                    }`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-2xl shrink-0">{ci?.icon ?? ti.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gravida-green">{time}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${ti.badge}`}>{ti.label}</span>
                            {p.category && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ci?.color ?? ''}`}>
                                {p.category}
                              </span>
                            )}
                            {isPosted && <span className="text-[10px] text-green-700 font-medium">✓ Geplaatst</span>}
                          </div>
                          {p.title && <p className="text-sm text-gravida-sage mt-0.5 truncate">{p.title}</p>}
                        </div>
                      </div>
                      <span className="text-gravida-sage text-lg shrink-0">›</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Aankomende belangrijke data */}
      {upcomingEvents.length > 0 && (
        <div className="card mb-6">
          <button onClick={() => setUpcomingOpen(o => !o)}
            className="w-full flex items-center justify-between text-left">
            <p className="text-xs font-semibold text-gravida-green uppercase tracking-wide">
              📅 Aankomende belangrijke data ({upcomingEvents.length})
            </p>
            <span className="text-xs text-gravida-light-sage">{upcomingOpen ? '▾' : '▸'}</span>
          </button>
          {upcomingOpen && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {upcomingEvents.map((e, i) => {
                const d = new Date(e.date + 'T00:00:00')
                const today = new Date(); today.setHours(0,0,0,0)
                const days = Math.round((d.getTime() - today.getTime()) / 86400000)
                const dateLabel = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                const dayLabel = days === 0 ? 'vandaag' : days === 1 ? 'morgen' : `over ${days} dagen`
                const bg = e.type === 'commercieel' ? 'bg-pink-50 border-pink-200'
                         : e.type === 'feestdag' ? 'bg-amber-50 border-amber-200'
                         : 'bg-emerald-50 border-emerald-200'
                return (
                  <button key={i} onClick={() => jumpToDate(e.date)}
                    className={`text-left rounded-lg border p-2.5 text-xs hover:shadow-sm transition-shadow ${bg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gravida-green flex items-center gap-1">
                          <span>{e.emoji}</span>
                          <span className="truncate">{e.name}</span>
                        </div>
                        {e.hook && <p className="text-[11px] text-gravida-sage mt-0.5 line-clamp-2">{e.hook}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold text-gravida-green">{dateLabel}</div>
                        <div className="text-[10px] text-gravida-light-sage">{dayLabel}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

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
              const dayEvents = eventsByDate.get(key) ?? []
              const eventBg = dayEvents.some(e => e.type === 'commercieel')
                ? 'bg-pink-50/40' : dayEvents.length > 0 ? 'bg-amber-50/30' : ''
              return (
                <div key={key}
                  onClick={() => openNewModal(d)}
                  className={`relative min-h-[90px] sm:min-h-[110px] rounded-xl p-1.5 sm:p-2 cursor-pointer transition-all border-2 ${
                    isToday ? 'border-gravida-sage' : 'border-transparent'
                  } ${inMonth ? `bg-white hover:bg-gravida-off-white ${eventBg}` : 'bg-gravida-cream/30 opacity-60'}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className={`text-xs sm:text-sm font-semibold ${isToday ? 'text-gravida-sage' : inMonth ? 'text-gravida-green' : 'text-gravida-light-sage'}`}>
                      {d.getDate()}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5" title={dayEvents.map(e => `${e.name}${e.hook ? ` — ${e.hook}` : ''}`).join('\n')}>
                        {dayEvents.slice(0, 2).map((e, i) => (
                          <span key={i} className="text-[10px] sm:text-xs">{e.emoji}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {dayEvents.length > 0 && inMonth && (
                    <div className="text-[8px] sm:text-[9px] text-gravida-sage truncate mb-1 leading-tight" title={dayEvents.map(e => e.name).join(', ')}>
                      {dayEvents[0].name}
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    {dayPosts.slice(0, 3).map(p => {
                      const time = formatNlTime(p.scheduled_for)
                      const thumb = p.image_urls?.[0]
                      const ti = typeInfo(p.post_type)
                      const ci = categoryInfo(p.category)
                      const isPosted = p.status === 'geplaatst' || p.status === 'posted'
                      const isReady = p.status === 'klaargezet' || p.status === 'scheduled'
                      return (
                        <button key={p.id} onClick={(e) => { e.stopPropagation(); openEditModal(p) }}
                          className={`relative flex items-center gap-1 sm:gap-1.5 px-1 sm:px-1.5 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] hover:opacity-80 transition-opacity overflow-hidden ${isPosted ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : ti.badge}`}
                          title={`${time} · ${ti.label} · ${p.category ?? ''} · ${p.title ?? p.caption?.slice(0, 40) ?? ''}${isPosted ? ' · GEPLAATST' : isReady ? ' · KLAARGEZET' : ''}`}
                        >
                          {/* Thumb / category icon */}
                          {thumb ? (
                            <ThumbOrFallback src={thumb} fallback={ci?.icon ?? ti.emoji} />
                          ) : (
                            <span className="text-[10px] sm:text-xs shrink-0">{ci?.icon ?? ti.emoji}</span>
                          )}
                          <span className="truncate">{time}{p.title ? ` · ${p.title.slice(0,15)}` : p.category ? ` · ${p.category.slice(0,12)}` : ''}</span>
                          {isPosted && (
                            <span className="ml-auto text-[10px] shrink-0" title="Geplaatst">✓</span>
                          )}
                          {isReady && !isPosted && (
                            <span className="ml-auto text-[10px] shrink-0 opacity-70" title="Klaargezet">⏱</span>
                          )}
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
                    const time = formatNlTime(p.scheduled_for)
                    const isFirstOfDay = postIdx === 0
                    return (
                      <tr key={p.id} className={`border-t border-gravida-cream group hover:opacity-95 transition-opacity ${ti.rowBg}`}>
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
                              🔗 Link →
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            onClick={() => cycleStatus(p)}
                            className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer outline-none whitespace-nowrap hover:opacity-80 ${statusInfo(p.status).color}`}
                            title="Klik om status te wijzigen"
                          >
                            {(p.status === 'geplaatst' || p.status === 'posted') && <span>✓</span>}
                            {(p.status === 'klaargezet' || p.status === 'scheduled') && <span>⏱</span>}
                            {statusInfo(p.status).label}
                          </button>
                        </td>
                        <td className="px-3 py-2 align-top relative">
                          <div className="flex flex-col gap-1">
                            <button onClick={() => openEditModal(p)} className="text-gravida-sage hover:text-gravida-green text-xs underline text-left">Bewerk</button>
                            <button
                              onClick={() => {
                                if (copyToPostId === p.id) {
                                  setCopyToPostId(null)
                                  setCopyToDate('')
                                } else {
                                  setCopyToPostId(p.id)
                                  // Default: morgen
                                  const tom = new Date(p.scheduled_for)
                                  tom.setDate(tom.getDate() + 1)
                                  setCopyToDate(tom.toISOString().slice(0, 10))
                                }
                              }}
                              className={`text-xs text-left transition-opacity ${copyToPostId === p.id ? 'text-gravida-green underline' : 'opacity-0 group-hover:opacity-100 text-gravida-sage hover:text-gravida-green underline'}`}
                            >
                              📋 Kopieer
                            </button>
                          </div>
                          {copyToPostId === p.id && (
                            <>
                              {/* Overlay vangt klikken buiten popover (sluit hem) */}
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => { setCopyToPostId(null); setCopyToDate('') }}
                              />
                              <div
                                onClick={e => e.stopPropagation()}
                                className="absolute z-50 right-0 bottom-full mb-2 bg-white border-2 border-gravida-sage rounded-xl shadow-2xl p-3 min-w-[240px]"
                              >
                                <p className="text-[10px] text-gravida-light-sage uppercase tracking-wide mb-1">Kopieer naar datum</p>
                                <input
                                  type="date"
                                  value={copyToDate}
                                  onChange={e => setCopyToDate(e.target.value)}
                                  className="input-field text-xs w-full mb-2"
                                  min={new Date().toISOString().slice(0, 10)}
                                />
                                <p className="text-[10px] text-gravida-light-sage mb-2">Tijdstip ({formatNlTime(p.scheduled_for)}) blijft hetzelfde. Start als <strong>draft</strong>.</p>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => { setCopyToPostId(null); setCopyToDate('') }}
                                    className="flex-1 text-xs px-2 py-1 rounded border border-gravida-cream text-gravida-sage"
                                  >
                                    Annuleren
                                  </button>
                                  <button
                                    onClick={() => copyToDate && duplicatePost(p, copyToDate)}
                                    disabled={!copyToDate || copying}
                                    className="flex-1 text-xs px-2 py-1 rounded bg-gravida-green text-white disabled:opacity-50"
                                  >
                                    {copying ? '...' : 'Kopieer'}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
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
              {/* Themadag-banner als de geplande datum op een feestdag/themadag valt */}
              {(() => {
                if (!form.scheduled_for_local) return null
                const [y, m, d] = form.scheduled_for_local.slice(0,10).split('-').map(Number)
                const evs = getEventForDate(y, m - 1, d)
                if (evs.length === 0) return null
                return (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">📅 Op deze dag</p>
                    {evs.map((e, i) => (
                      <div key={i} className="text-xs text-amber-900">
                        <span className="font-medium">{e.emoji} {e.name}</span>
                        {e.hook && <span className="text-amber-700"> — {e.hook}</span>}
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* AI ideeen-sectie */}
              <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">✨ AI assistent</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button type="button" onClick={() => setAiContextOpen(o => !o)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors
                        ${aiCustomContext.trim() ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-white border-purple-300 text-purple-700 hover:bg-purple-100'}`}>
                      {aiContextOpen ? '✕ Context sluiten' : aiCustomContext.trim() ? '📝 Eigen context (ingevuld)' : '➕ Eigen context'}
                    </button>
                    <button type="button" onClick={() => generateAiIdeas('ideas')} disabled={aiLoading}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
                      {aiLoading ? '⏳ Bezig...' : '💡 Genereer 5 ideeën'}
                    </button>
                    {aiCustomContext.trim() && (
                      <button type="button" onClick={() => generateAiIdeas('custom')} disabled={aiLoading}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-fuchsia-600 text-white hover:bg-fuchsia-700 disabled:opacity-50">
                        🎯 5 captions o.b.v. context
                      </button>
                    )}
                    {form.title && (
                      <button type="button" onClick={() => generateAiIdeas('caption')} disabled={aiLoading}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-white border border-purple-300 text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                        ✏️ Schrijf caption voor titel
                      </button>
                    )}
                  </div>
                </div>
                {aiContextOpen && (
                  <div className="bg-white rounded-lg border border-purple-200 p-2.5">
                    <label className="text-[11px] font-medium text-purple-800 block mb-1">
                      📝 Beschrijf de post die je in gedachten hebt
                    </label>
                    <textarea
                      rows={4}
                      className="w-full text-xs px-2 py-1.5 border border-purple-200 rounded focus:outline-none focus:border-purple-500"
                      placeholder="Bijv: Ik heb een foto van 2 gegoten beeldjes als sneak preview. Bonnie, onze supervisor van het bronsteam, is naar het buitenland geweest om in de leer te gaan bij de meesters op dit gebied. Ik wil dit delen als sneak preview van wat eraan komt."
                      value={aiCustomContext}
                      onChange={e => setAiCustomContext(e.target.value)}
                    />
                    <p className="text-[10px] text-purple-700/70 mt-1">
                      Tip: hoe specifieker, hoe beter. Noemen wie/wat/waarom geeft de AI iets om mee te werken.
                      Klik daarna &quot;🎯 5 captions o.b.v. context&quot; voor 5 verschillende invalshoeken.
                    </p>
                  </div>
                )}
                {aiError && <p className="text-[11px] text-red-600">{aiError}</p>}
                {aiIdeas.length > 0 && (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {aiIdeas.map((idea, i) => (
                      <div key={i} className="bg-white rounded-lg border border-purple-100 p-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-semibold text-gravida-green">{idea.title}</p>
                          <button type="button" onClick={() => applyAiIdea(idea)}
                            className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-gravida-sage text-white hover:bg-gravida-green">
                            Gebruik
                          </button>
                        </div>
                        <p className="text-[11px] text-gravida-sage mb-1">
                          <span className="inline-block bg-gravida-cream px-1.5 py-0.5 rounded mr-1 text-[10px]">{idea.post_type}</span>
                          {idea.reasoning}
                        </p>
                        <p className="text-[11px] text-gravida-green/80 line-clamp-3 mb-1">{idea.caption}</p>
                        <p className="text-[10px] text-gravida-light-sage truncate">{idea.hashtags}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!aiLoading && aiIdeas.length === 0 && !aiError && (
                  <p className="text-[11px] text-purple-700/70">
                    Klik &quot;Genereer 5 ideeën&quot; voor brainstorm op basis van categorie/type/datum.
                  </p>
                )}
              </div>

              {/* Klaar voor Instagram — quick-copy helpers (alleen bij bestaande posts) */}
              {editingPost && (
                <div className="rounded-xl border border-gravida-cream bg-gravida-off-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gravida-sage uppercase tracking-wide">📲 Klaar voor Instagram</p>
                    {(editingPost.status !== 'geplaatst' && editingPost.status !== 'posted') && (
                      <button
                        onClick={async () => {
                          if (!confirm('Deze post markeren als GEPLAATST? (alleen doen als hij echt op Instagram staat)')) return
                          const res = await fetch(`/api/admin/social-posts/${editingPost.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'geplaatst' }),
                          })
                          if (res.ok) { await load(); setModalOpen(false) }
                        }}
                        className="text-[10px] font-medium px-2 py-1 rounded-md border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                        title="Markeer als geplaatst — vraagt eerst bevestiging"
                      >
                        Markeer geplaatst
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.caption && (
                      <button type="button"
                        onClick={() => { navigator.clipboard.writeText(form.caption ?? ''); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream hover:border-gravida-sage transition-colors flex items-center gap-1.5"
                        title="Caption naar klembord">
                        📋 Caption
                      </button>
                    )}
                    {form.hashtags && (
                      <button type="button"
                        onClick={() => { navigator.clipboard.writeText(form.hashtags ?? ''); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream hover:border-gravida-sage transition-colors flex items-center gap-1.5"
                        title="Hashtags naar klembord">
                        # Hashtags
                      </button>
                    )}
                    {(form.caption || form.hashtags) && (
                      <button type="button"
                        onClick={() => {
                          const all = [form.caption, form.hashtags].filter(Boolean).join('\n\n')
                          navigator.clipboard.writeText(all)
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gravida-sage text-white hover:bg-gravida-green transition-colors flex items-center gap-1.5"
                        title="Caption + hashtags samen naar klembord">
                        📋 Alles kopiëren
                      </button>
                    )}
                    {form.image_urls_text && form.image_urls_text.trim() && (() => {
                      const urls = (form.image_urls_text ?? '').split('\n').map(s => s.trim()).filter(Boolean)
                      const downloadAll = async () => {
                        // Fetch elke media file als blob en trigger download
                        for (let i = 0; i < urls.length; i++) {
                          const url = urls[i]
                          try {
                            const res = await fetch(url)
                            const blob = await res.blob()
                            const blobUrl = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = blobUrl
                            const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg'
                            a.download = `gravida-${editingPost?.id ?? 'post'}-${i+1}.${ext}`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(blobUrl)
                            // Korte vertraging tussen bestanden zodat browser ze niet samenvoegt
                            if (i < urls.length - 1) await new Promise(r => setTimeout(r, 300))
                          } catch (err) {
                            console.error('Download fout:', err)
                          }
                        }
                      }
                      return (
                        <button type="button" onClick={downloadAll}
                          className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream hover:border-gravida-sage transition-colors flex items-center gap-1.5"
                          title={`Download ${urls.length} ${urls.length === 1 ? 'bestand' : 'bestanden'} naar je toestel — kan steeds opnieuw`}>
                          ⬇️ Download media{urls.length > 1 ? ` (${urls.length})` : ''}
                        </button>
                      )
                    })()}
                    <button
                      type="button"
                      onClick={async () => {
                        // Open IG immediately (window.open inside a user click is allowed)
                        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
                        // Auto-mark as geplaatst if not already
                        const isAlreadyPosted = editingPost.status === 'geplaatst' || editingPost.status === 'posted'
                        if (!isAlreadyPosted) {
                          const res = await fetch(`/api/admin/social-posts/${editingPost.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'geplaatst' }),
                          })
                          if (res.ok) await load()
                        }
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-pink-100 text-pink-700 hover:bg-pink-200 transition-colors flex items-center gap-1.5"
                      title="Opent Instagram in nieuwe tab én markeert deze post als geplaatst">
                      📷 Open Instagram &amp; markeer geplaatst
                    </button>
                  </div>
                  {!form.caption && !form.hashtags && (
                    <p className="text-[11px] text-gravida-light-sage italic">Vul caption / hashtags hieronder in om te kunnen kopiëren.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">Datum &amp; tijd * <span className="text-[10px] font-normal text-gravida-light-sage ml-1">(altijd Nederlandse tijd 🇳🇱)</span></label>
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
                    <button
                      type="button"
                      onClick={() => setLibraryPickerOpen(true)}
                      className="flex-1 text-center py-2 px-4 rounded-lg border-2 border-gravida-sage bg-gravida-sage/5 hover:bg-gravida-sage/10 text-gravida-sage text-xs font-medium transition-colors"
                    >
                      🗂 Kies uit mediabibliotheek
                    </button>
                    <label className={`flex-1 cursor-pointer text-center py-2 px-4 rounded-lg border-2 border-dashed border-gravida-cream hover:border-gravida-sage transition-colors text-xs ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      📎 Bestand kiezen (jpg/png/mp4)
                      <input type="file" className="hidden"
                        accept="image/*,video/*"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? [])
                          if (files.length === 0) return
                          setUploading(true); setUploadError('')
                          // Dynamic import zodat we het pas bij klik laden
                          const { upload } = await import('@vercel/blob/client')
                          const newUrls: string[] = []
                          for (const file of files) {
                            try {
                              const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
                              const pathname = `social/${Date.now()}-${safe}`
                              const blob = await upload(pathname, file, {
                                access: 'public',
                                handleUploadUrl: '/api/admin/social-posts/upload',
                                contentType: file.type,
                              })
                              if (blob.url) newUrls.push(blob.url)
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : String(err)
                              setUploadError(`Upload mislukt bij ${file.name}: ${msg}`)
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
                  {form.image_urls_text && form.image_urls_text.trim() && (() => {
                    const urls = form.image_urls_text.split('\n').map(s => s.trim()).filter(Boolean)
                    const updateUrls = (next: string[]) => setForm(f => ({ ...f, image_urls_text: next.join('\n') }))
                    const move = (i: number, dir: -1 | 1) => {
                      const target = i + dir
                      if (target < 0 || target >= urls.length) return
                      const next = [...urls]
                      ;[next[i], next[target]] = [next[target], next[i]]
                      updateUrls(next)
                    }
                    const removeAt = (i: number) => updateUrls(urls.filter((_, k) => k !== i))
                    const isCarousel = urls.length > 1
                    return (
                      <>
                        {isCarousel && (
                          <div className="mt-2 mb-1 flex items-center gap-2">
                            <span className="text-[11px] text-gravida-sage">
                              {urls.length} dia&apos;s · sleep volgorde met de pijltjes
                            </span>
                            {form.post_type !== 'carousel' && form.post_type !== 'reel' && (
                              <button type="button"
                                onClick={() => setForm(f => ({ ...f, post_type: 'carousel' }))}
                                className="text-[11px] text-emerald-700 hover:underline">
                                → Markeer als carousel
                              </button>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                          {urls.map((url, i) => {
                            const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url)
                            return (
                              <div key={i} className="relative shrink-0 group">
                                {isVideo ? (
                                  <video src={url} muted playsInline
                                    className="w-20 h-20 rounded-lg object-cover border border-gravida-cream bg-black"
                                  />
                                ) : (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={url} alt={`dia ${i+1}`}
                                    className="w-20 h-20 rounded-lg object-cover border border-gravida-cream"
                                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                                  />
                                )}
                                {/* slide nummer */}
                                <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-gravida-green text-white text-[10px] font-bold flex items-center justify-center">
                                  {i + 1}
                                </div>
                                {/* verwijder */}
                                <button type="button" onClick={() => removeAt(i)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Verwijder uit selectie">✕</button>
                                {/* pijltjes */}
                                {urls.length > 1 && (
                                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5">
                                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                                      className="w-5 h-5 rounded bg-white/90 text-gravida-sage text-[10px] disabled:opacity-30 hover:bg-white"
                                      title="Naar voren">‹</button>
                                    <button type="button" onClick={() => move(i, 1)} disabled={i === urls.length - 1}
                                      className="w-5 h-5 rounded bg-white/90 text-gravida-sage text-[10px] disabled:opacity-30 hover:bg-white"
                                      title="Naar achteren">›</button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Link toevoegen (optioneel)</label>
                  <input className="input-field" placeholder="https://..."
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

      {/* Ideeen-modal: statische lijst per categorie */}
      {ideasModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gravida-sage">💡 Content-ideeën per categorie</h2>
                <p className="text-xs text-gravida-light-sage mt-1">Klik op een idee om er een nieuwe post van te maken.</p>
              </div>
              <button onClick={() => setIdeasModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center transition-colors text-gravida-light-sage">✕</button>
            </div>
            <div className="px-6 pt-4 pb-2 flex flex-wrap gap-1.5 border-b border-gravida-cream">
              {CATEGORIES.map(c => (
                <button key={c.value} onClick={() => setIdeasCategory(c.value)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    ideasCategory === c.value
                      ? 'bg-gravida-sage text-white border-gravida-sage'
                      : `${c.color} hover:opacity-80`
                  }`}>
                  {c.icon} {c.value}
                </button>
              ))}
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {(CONTENT_IDEAS[ideasCategory] ?? []).map((idea, i) => (
                <div key={i} className="rounded-lg border border-gravida-cream p-3 hover:border-gravida-sage transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gravida-green">{idea.title}</p>
                      <p className="text-xs text-gravida-sage mt-0.5">{idea.description}</p>
                      {idea.bestType && (
                        <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded ${POST_TYPES.find(t => t.value === idea.bestType)?.badge ?? 'bg-gray-100 text-gray-700'}`}>
                          {idea.bestType}
                        </span>
                      )}
                    </div>
                    <button onClick={() => useCategoryIdea(idea, ideasCategory)}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gravida-sage text-white hover:bg-gravida-green transition-colors">
                      Gebruik
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gravida-cream flex justify-between items-center">
              <p className="text-[11px] text-gravida-light-sage italic">
                Wil je AI-gegenereerde varianten? Open een post en klik op &quot;✨ Genereer ideeën&quot;.
              </p>
              <button onClick={() => setIdeasModalOpen(false)} className="text-xs px-3 py-1.5 rounded-lg border border-gravida-cream hover:border-gravida-sage">
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk-delete modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-red-700">🗑️ Wis posts uit {DUTCH_MONTHS[calMonth]} {calYear}</h2>
                <p className="text-xs text-gravida-light-sage mt-1">Geplaatste posts blijven default behouden — kies hieronder welke je echt wilt verwijderen.</p>
              </div>
              <button onClick={() => setBulkDeleteOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center text-gravida-light-sage">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Welke posts?</label>
                <select className="input-field" value={bulkDeleteFilter} onChange={e => setBulkDeleteFilter(e.target.value as typeof bulkDeleteFilter)}>
                  <option value="draft">Alleen Concepten</option>
                  <option value="klaargezet">Alleen Klaargezet</option>
                  <option value="gemist">Alleen Gemist</option>
                  <option value="geplaatst">Alleen Geplaatst (let op!)</option>
                  <option value="all">Alle statussen (gevaarlijk)</option>
                </select>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={bulkOnlyEmpty} onChange={e => setBulkOnlyEmpty(e.target.checked)}
                  className="mt-0.5" />
                <span className="text-sm">
                  <strong>Alleen lege posts</strong>
                  <span className="block text-[11px] text-gravida-light-sage">
                    Verwijdert posts zonder caption én zonder media. Posts met alleen een placeholder-titel (zoals &quot;Reel: beeldjes proces&quot; uit de template) worden ook meegenomen.
                  </span>
                </span>
              </label>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                ⚠️ Deze actie verwijdert posts permanent. Maak eerst een backup als je twijfelt.
              </div>
            </div>
            <div className="p-4 border-t border-gravida-cream flex justify-end gap-2">
              <button onClick={() => setBulkDeleteOpen(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gravida-cream hover:border-gravida-sage">
                Annuleren
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {bulkDeleting ? 'Verwijderen...' : '🗑️ Verwijder'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaLibraryPicker
        open={libraryPickerOpen}
        onClose={() => setLibraryPickerOpen(false)}
        onPick={(urls) => {
          if (urls.length === 0) return
          const existing = form.image_urls_text ?? ''
          const combined = (existing.trim() + '\n' + urls.join('\n')).trim()
          setForm(f => ({ ...f, image_urls_text: combined }))
        }}
      />
    </div>
  )
}

/**
 * Tiny thumbnail with graceful fallback to an emoji/icon if the image fails to
 * load (e.g. blob URL expired, file deleted, CORS hiccup). Tries video poster
 * for video URLs.
 */
function ThumbOrFallback({ src, fallback }: { src: string; fallback: string }) {
  const [errored, setErrored] = useState(false)
  const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(src)

  if (errored) {
    return <span className="text-[10px] sm:text-xs shrink-0">{fallback}</span>
  }

  if (isVideo) {
    return (
      <video
        src={src}
        className="w-4 h-4 sm:w-5 sm:h-5 rounded object-cover shrink-0 bg-black"
        muted
        playsInline
        onError={() => setErrored(true)}
      />
    )
  }

  return (
    <img
      src={src}
      alt=""
      className="w-4 h-4 sm:w-5 sm:h-5 rounded object-cover shrink-0"
      onError={() => setErrored(true)}
    />
  )
}
