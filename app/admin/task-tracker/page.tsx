'use client'

import { useEffect, useMemo, useState } from 'react'

interface Task {
  id: number
  summary: string
  description: string | null
  type: 'bug' | 'feature' | 'change'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'ready_for_testing' | 'completed' | 'deferred'
  assigned_by: string | null
  assigned_to: string | null
  due_date: string | null
  screenshot_urls: string[] | null
  created_at: string
  updated_at: string
}

const TYPES = [
  { value: 'bug',     label: '🐞 Bug',     color: 'bg-red-100 text-red-700' },
  { value: 'feature', label: '✨ Feature', color: 'bg-blue-100 text-blue-700' },
  { value: 'change',  label: '🔧 Change',  color: 'bg-amber-100 text-amber-700' },
]

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'high',     label: 'High',     color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'medium',   label: 'Medium',   color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'low',      label: 'Low',      color: 'bg-gray-100 text-gray-600 border-gray-200' },
]

const STATUSES = [
  { value: 'open',              label: 'Open',          dot: 'bg-blue-500',    bg: 'bg-blue-50 text-blue-700' },
  { value: 'in_progress',       label: 'In progress',   dot: 'bg-purple-500',  bg: 'bg-purple-50 text-purple-700' },
  { value: 'ready_for_testing', label: 'Ready',         dot: 'bg-orange-500',  bg: 'bg-orange-50 text-orange-700' },
  { value: 'completed',         label: 'Completed',     dot: 'bg-green-500',   bg: 'bg-green-50 text-green-700' },
  { value: 'deferred',          label: 'Deferred',      dot: 'bg-gray-400',    bg: 'bg-gray-100 text-gray-600' },
]

const ASSIGNEES = ['Marit', 'Laila']

const EMPTY_FORM = {
  summary: '',
  description: '',
  type: 'bug' as Task['type'],
  priority: 'medium' as Task['priority'],
  status: 'open' as Task['status'],
  assigned_by: 'Marit' as string | null,
  assigned_to: '' as string | null,
  due_date: '',
  screenshot_urls: [] as string[],
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

function avatarColor(name: string | null): string {
  if (!name) return 'bg-gray-300'
  const palette = ['bg-rose-400', 'bg-purple-400', 'bg-blue-400', 'bg-emerald-400', 'bg-amber-400']
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return palette[hash % palette.length]
}

export default function TaskTrackerPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | Task['status']>('open')

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/tasks')
      const data = await res.json()
      setTasks(data.tasks ?? [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const total = tasks.length || 1  // avoid /0
    const counts = {
      open: tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length,
      ready: tasks.filter(t => t.status === 'ready_for_testing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      deferred: tasks.filter(t => t.status === 'deferred').length,
    }
    return {
      ...counts,
      total: tasks.length,
      pct: {
        open: Math.round(counts.open / total * 100),
        ready: Math.round(counts.ready / total * 100),
        completed: Math.round(counts.completed / total * 100),
        deferred: Math.round(counts.deferred / total * 100),
      },
    }
  }, [tasks])

  const filtered = useMemo(() => {
    let list = tasks
    if (filterStatus === 'open') list = list.filter(t => t.status === 'open' || t.status === 'in_progress')
    else if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.summary.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q) ||
        (t.assigned_by ?? '').toLowerCase().includes(q) ||
        ('TT-' + String(t.id).padStart(3, '0')).toLowerCase().includes(q)
      )
    }
    return list
  }, [tasks, filterStatus, search])

  const openNewModal = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  const openEditModal = (t: Task) => {
    setEditing(t)
    setForm({
      summary: t.summary,
      description: t.description ?? '',
      type: t.type,
      priority: t.priority,
      status: t.status,
      assigned_by: t.assigned_by ?? '',
      assigned_to: t.assigned_to ?? '',
      due_date: t.due_date ? t.due_date.slice(0, 10) : '',
      screenshot_urls: t.screenshot_urls ?? [],
    })
    setError('')
    setModalOpen(true)
  }

  const handleScreenshotUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true); setError('')
    const newUrls: string[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/admin/tasks/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (res.ok && data.url) newUrls.push(data.url)
        else setError(data.error ?? `Upload mislukt: ${file.name}`)
      } catch {
        setError(`Verbindingsfout bij ${file.name}`)
      }
    }
    if (newUrls.length > 0) {
      setForm(f => ({ ...f, screenshot_urls: [...f.screenshot_urls, ...newUrls] }))
    }
    setUploading(false)
  }

  const removeScreenshot = (url: string) => {
    setForm(f => ({ ...f, screenshot_urls: f.screenshot_urls.filter(u => u !== url) }))
  }

  const handleSave = async () => {
    if (!form.summary.trim()) { setError('Samenvatting is verplicht'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        ...form,
        assigned_by: form.assigned_by || null,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
      }
      const res = await fetch(editing ? `/api/admin/tasks/${editing.id}` : '/api/admin/tasks', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { setModalOpen(false); await load() }
      else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Opslaan mislukt')
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!editing) return
    if (!confirm('Deze taak echt verwijderen?')) return
    const res = await fetch(`/api/admin/tasks/${editing.id}`, { method: 'DELETE' })
    if (res.ok) { setModalOpen(false); await load() }
  }

  const cycleStatus = async (task: Task) => {
    const order: Task['status'][] = ['open', 'in_progress', 'ready_for_testing', 'completed', 'deferred']
    const idx = order.indexOf(task.status)
    const next = order[(idx + 1) % order.length]
    const res = await fetch(`/api/admin/tasks/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
  }

  const typeInfo = (v: string) => TYPES.find(x => x.value === v) ?? TYPES[0]
  const priorityInfo = (v: string) => PRIORITIES.find(x => x.value === v) ?? PRIORITIES[2]
  const statusInfo = (v: string) => STATUSES.find(x => x.value === v) ?? STATUSES[0]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Task tracker</h1>
          <p className="text-gravida-sage mt-1 text-sm">Houd bugs, features en wijzigingen bij voor het dashboard.</p>
        </div>
        <button onClick={openNewModal} className="btn-primary shrink-0">+ Nieuwe taak</button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Open"      value={stats.open}      pct={stats.pct.open}      total={stats.total} icon="⏱" color="border-t-blue-500" iconBg="bg-blue-50 text-blue-600" />
        <StatCard label="Ready"     value={stats.ready}     pct={stats.pct.ready}     total={stats.total} icon="🔧" color="border-t-orange-500" iconBg="bg-orange-50 text-orange-600" />
        <StatCard label="Completed" value={stats.completed} pct={stats.pct.completed} total={stats.total} icon="✓" color="border-t-green-500" iconBg="bg-green-50 text-green-600" />
        <StatCard label="Deferred"  value={stats.deferred}  pct={stats.pct.deferred}  total={stats.total} icon="⏸" color="border-t-gray-400" iconBg="bg-gray-100 text-gray-600" />
      </div>

      {/* Filter tabs + search */}
      <div className="card mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            <FilterTab active={filterStatus === 'all'}      onClick={() => setFilterStatus('all')}      label="All"       count={tasks.length} />
            <FilterTab active={filterStatus === 'open'}     onClick={() => setFilterStatus('open')}     label="Open"      count={stats.open} />
            <FilterTab active={filterStatus === 'ready_for_testing'} onClick={() => setFilterStatus('ready_for_testing')} label="Ready" count={stats.ready} />
            <FilterTab active={filterStatus === 'completed'} onClick={() => setFilterStatus('completed')} label="Done"     count={stats.completed} />
            <FilterTab active={filterStatus === 'deferred'} onClick={() => setFilterStatus('deferred')}  label="Deferred"  count={stats.deferred} />
          </div>
          <div className="sm:ml-auto sm:max-w-xs flex-1">
            <input className="input-field text-sm py-1.5" placeholder="🔍 Zoek taken..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        {loading ? (
          <div className="p-12 text-center text-gravida-light-sage text-sm">Laden...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gravida-light-sage text-sm">
            {search ? 'Geen taken gevonden voor deze zoekopdracht.' : 'Nog geen taken. Voeg er een toe met "+ Nieuwe taak".'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gravida-cream/50 border-b border-gravida-cream">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs whitespace-nowrap">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs">SAMENVATTING</th>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs whitespace-nowrap">TYPE</th>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs whitespace-nowrap">PRIORITEIT</th>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs whitespace-nowrap">STATUS</th>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs whitespace-nowrap">AANGEMAAKT</th>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs whitespace-nowrap">DOOR</th>
                <th className="text-left px-4 py-3 font-medium text-gravida-light-sage text-xs whitespace-nowrap">TOEGEWEZEN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gravida-cream">
              {filtered.map(t => {
                const ti = typeInfo(t.type)
                const pi = priorityInfo(t.priority)
                const si = statusInfo(t.status)
                const overdue = t.due_date && t.status !== 'completed' && t.status !== 'deferred' && new Date(t.due_date) < new Date()
                return (
                  <tr key={t.id} className="hover:bg-gravida-off-white transition-colors cursor-pointer" onClick={() => openEditModal(t)}>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gravida-light-sage">
                      TT-{String(t.id).padStart(3, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gravida-green flex items-center gap-1.5">
                        {t.summary}
                        {(t.screenshot_urls && t.screenshot_urls.length > 0) && (
                          <span title={`${t.screenshot_urls.length} screenshot(s)`} className="text-[10px] bg-gravida-cream px-1 py-0.5 rounded">
                            📎{t.screenshot_urls.length}
                          </span>
                        )}
                      </div>
                      {overdue && (
                        <div className="text-xs text-red-600 mt-0.5">
                          ⚠ Verlopen — deadline {formatShortDate(t.due_date)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${ti.color}`}>
                        {ti.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${pi.color}`}>
                        {pi.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); cycleStatus(t) }}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${si.bg} hover:opacity-80 transition-opacity`}
                        title="Klik om status te wisselen"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${si.dot}`} />
                        {si.label}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gravida-sage text-xs">{formatShortDate(t.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.assigned_by ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-semibold ${avatarColor(t.assigned_by)}`}>
                            {t.assigned_by.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs text-gravida-sage">{t.assigned_by}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gravida-light-sage italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {t.assigned_to ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-[10px] font-semibold ${avatarColor(t.assigned_to)}`}>
                            {t.assigned_to.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs text-gravida-sage">{t.assigned_to}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gravida-light-sage italic">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gravida-sage">
                  {editing ? `Taak TT-${String(editing.id).padStart(3, '0')}` : 'Nieuwe taak'}
                </h2>
                {editing && (
                  <p className="text-[11px] text-gravida-light-sage mt-0.5">
                    Aangemaakt {formatShortDate(editing.created_at)}{editing.updated_at !== editing.created_at ? ` · gewijzigd ${formatShortDate(editing.updated_at)}` : ''}
                  </p>
                )}
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center text-gravida-light-sage">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Samenvatting *</label>
                <input className="input-field" placeholder="Korte beschrijving van het probleem of de wens"
                  value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} />
              </div>

              <div>
                <label className="label">Beschrijving</label>
                <textarea className="input-field" rows={4}
                  placeholder="Stappen om te reproduceren / context / gewenst gedrag"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Type</label>
                  <select className="input-field" value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as Task['type'] }))}>
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Prioriteit</label>
                  <select className="input-field" value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input-field" value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Task['status'] }))}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Aangemaakt door</label>
                  <select className="input-field" value={form.assigned_by ?? ''}
                    onChange={e => setForm(f => ({ ...f, assigned_by: e.target.value }))}>
                    <option value="">— niemand —</option>
                    {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Toegewezen aan</label>
                  <select className="input-field" value={form.assigned_to ?? ''}
                    onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                    <option value="">— niemand —</option>
                    {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Deadline (optioneel)</label>
                  <input type="date" className="input-field"
                    value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>

              {/* Screenshots */}
              <div>
                <label className="label flex items-center justify-between">
                  <span>📎 Screenshots</span>
                  <span className="text-[10px] font-normal text-gravida-light-sage">
                    {uploading ? 'Uploaden...' : `${form.screenshot_urls.length} bestand(en)`}
                  </span>
                </label>
                <label className={`block cursor-pointer text-center py-2 px-4 rounded-lg border-2 border-dashed border-gravida-cream hover:border-gravida-sage transition-colors text-xs mb-2 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  📷 Voeg afbeelding(en) toe (jpg/png/webp/gif, max 10 MB)
                  <input type="file" className="hidden" accept="image/*" multiple
                    onChange={(e) => { handleScreenshotUpload(e.target.files); e.target.value = '' }}
                  />
                </label>
                {form.screenshot_urls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {form.screenshot_urls.map((url, i) => (
                      <div key={i} className="relative group">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`screenshot ${i+1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gravida-cream" />
                        </a>
                        <button type="button" onClick={() => removeScreenshot(url)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Verwijderen">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              <div className="flex gap-2 pt-2">
                {editing && (
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
                  {saving ? 'Opslaan...' : editing ? 'Opslaan' : 'Aanmaken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, pct, total, icon, color, iconBg }: {
  label: string; value: number; pct: number; total: number; icon: string; color: string; iconBg: string
}) {
  return (
    <div className={`bg-white rounded-xl border border-gravida-cream p-4 border-t-4 ${color}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${iconBg}`}>
          {icon}
        </div>
        <span className="text-[10px] font-semibold text-gravida-light-sage uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gravida-green">{value}</div>
      <div className="text-xs text-gravida-light-sage mt-1">
        {total === 0 ? '0%' : `${pct}%`} of total
      </div>
    </div>
  )
}

function FilterTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active ? 'bg-gravida-sage text-white' : 'bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage'
      }`}>
      {label}
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-gravida-cream/60'}`}>
        {count}
      </span>
    </button>
  )
}
