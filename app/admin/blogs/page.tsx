'use client'

import { useEffect, useState } from 'react'

interface FAQItem { question: string; answer: string }

interface BlogPost {
  id: number
  slug: string
  title: string
  excerpt: string | null
  content: string
  hero_image_url: string | null
  category: string | null
  tags: string[] | null
  author: string | null
  is_published: boolean
  published_at: string | null
  meta_title: string | null
  meta_description: string | null
  focus_keyword: string | null
  key_takeaway: string | null
  faq_json: FAQItem[] | null
  related_keywords: string[] | null
  created_at: string
  updated_at: string
}

const EMPTY: Omit<BlogPost, 'id' | 'slug' | 'created_at' | 'updated_at'> = {
  title: '', excerpt: '', content: '', hero_image_url: null, category: '',
  tags: [], author: 'Laila', is_published: false, published_at: null,
  meta_title: '', meta_description: '', focus_keyword: '', key_takeaway: '',
  faq_json: [], related_keywords: [],
}

export default function BlogsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<typeof EMPTY>(EMPTY)
  const [tagsText, setTagsText] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [aiInstructions, setAiInstructions] = useState('')

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/admin/blogs')
    const d = await r.json()
    setPosts(d.posts ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditingId(null)
    setForm(EMPTY)
    setTagsText('')
    setAiInstructions(''); setAiError('')
    setShowEditor(true)
  }

  const openEdit = async (id: number) => {
    const r = await fetch(`/api/admin/blogs/${id}`)
    const d = await r.json()
    if (d.post) {
      setEditingId(id)
      setForm({
        title: d.post.title,
        excerpt: d.post.excerpt ?? '',
        content: d.post.content ?? '',
        hero_image_url: d.post.hero_image_url ?? null,
        category: d.post.category ?? '',
        tags: d.post.tags ?? [],
        author: d.post.author ?? 'Laila',
        is_published: d.post.is_published,
        published_at: d.post.published_at,
        meta_title: d.post.meta_title ?? '',
        meta_description: d.post.meta_description ?? '',
        focus_keyword: d.post.focus_keyword ?? '',
        key_takeaway: d.post.key_takeaway ?? '',
        faq_json: Array.isArray(d.post.faq_json) ? d.post.faq_json : [],
        related_keywords: Array.isArray(d.post.related_keywords) ? d.post.related_keywords : [],
      })
      setTagsText((d.post.tags ?? []).join(', '))
      setAiInstructions(''); setAiError('')
      setShowEditor(true)
    }
  }

  const save = async () => {
    const payload = {
      ...form,
      tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
      faq_json: (form.faq_json ?? []).filter(f => f.question.trim() && f.answer.trim()),
    }
    if (editingId) {
      await fetch(`/api/admin/blogs/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/admin/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setShowEditor(false)
    await load()
  }

  const remove = async (id: number) => {
    if (!confirm('Blogpost verwijderen?')) return
    await fetch(`/api/admin/blogs/${id}`, { method: 'DELETE' })
    await load()
  }

  const generateWithAI = async () => {
    if (!form.title.trim()) { setAiError('Vul eerst een titel in'); return }
    setAiBusy(true); setAiError('')
    try {
      const res = await fetch('/api/admin/blogs/ai-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          excerpt: form.excerpt,
          category: form.category,
          extra_instructions: aiInstructions,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAiError(data.error ?? 'AI mislukt'); return }
      setForm(f => ({
        ...f,
        excerpt: data.excerpt || f.excerpt,
        content: data.content || f.content,
      }))
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        setTagsText(data.tags.join(', '))
      }
      setForm(f => ({
        ...f,
        meta_title: data.meta_title || f.meta_title,
        meta_description: data.meta_description || f.meta_description,
        focus_keyword: data.focus_keyword || f.focus_keyword,
        key_takeaway: data.key_takeaway || f.key_takeaway,
        faq_json: Array.isArray(data.faq) && data.faq.length > 0 ? data.faq : f.faq_json,
        related_keywords: Array.isArray(data.related_keywords) ? data.related_keywords : f.related_keywords,
      }))
      setAiInstructions('')
    } catch (err) {
      setAiError('AI mislukt: ' + String(err))
    } finally {
      setAiBusy(false)
    }
  }

  const uploadHero = async (file: File) => {
    setUploadingHero(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'blogs')
    const res = await fetch('/api/admin/cms/upload', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok && data.url) {
      setForm(f => ({ ...f, hero_image_url: data.url }))
    }
    setUploadingHero(false)
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Blogs</h1>
          <p className="text-gravida-sage mt-1 text-sm">Blogposts voor de website. Verschijnen op gravida.nl als ze gepubliceerd zijn.</p>
        </div>
        <button onClick={openNew} className="btn-primary">+ Nieuwe blogpost</button>
      </div>

      {loading ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gravida-light-sage">Nog geen blogposts.</p>
      ) : (
        <div className="space-y-2">
          {posts.map(p => (
            <div key={p.id} className="card flex items-center gap-3 cursor-pointer hover:shadow-sm" onClick={() => openEdit(p.id)}>
              {p.hero_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.hero_image_url} className="w-20 h-20 object-cover rounded-lg shrink-0" alt="" />
              ) : (
                <div className="w-20 h-20 bg-gravida-cream rounded-lg flex items-center justify-center text-2xl shrink-0">📝</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gravida-green truncate">{p.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${p.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {p.is_published ? 'Live' : 'Concept'}
                  </span>
                  {p.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{p.category}</span>}
                </div>
                {p.excerpt && <p className="text-xs text-gravida-sage mt-1 line-clamp-2">{p.excerpt}</p>}
                <p className="text-[10px] text-gravida-light-sage mt-1 font-mono">/{p.slug}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gravida-cream flex justify-between items-start">
              <h2 className="text-lg font-bold text-gravida-sage">
                {editingId ? 'Blogpost bewerken' : 'Nieuwe blogpost'}
              </h2>
              <button onClick={() => setShowEditor(false)} className="w-8 h-8 rounded-full hover:bg-gravida-cream flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Titel *</label>
                <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="label">Hero afbeelding</label>
                {form.hero_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.hero_image_url} className="w-full max-w-md h-40 object-cover rounded-lg mb-2" alt="" />
                )}
                <label className={`inline-block cursor-pointer text-xs px-3 py-1.5 rounded-lg bg-white border border-gravida-cream hover:border-gravida-sage ${uploadingHero ? 'opacity-50' : ''}`}>
                  {uploadingHero ? 'Uploaden...' : (form.hero_image_url ? 'Vervangen' : '+ Hero uploaden')}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.target.value = '' }} />
                </label>
                {form.hero_image_url && (
                  <button onClick={() => setForm({ ...form, hero_image_url: null })} className="ml-2 text-xs text-red-600 hover:underline">
                    Verwijderen
                  </button>
                )}
              </div>
              <div>
                <label className="label">Excerpt (korte intro)</label>
                <textarea rows={2} className="input-field" value={form.excerpt ?? ''} onChange={e => setForm({ ...form, excerpt: e.target.value })} />
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs text-purple-900">
                    <strong>✨ AI concept schrijven</strong>
                    <p className="text-purple-700 text-[11px] mt-0.5">Op basis van de titel hierboven schrijft Claude een volledige blogpost in Gravida-stijl, ondertekend door Laila. Excerpt, content en tags worden gevuld.</p>
                  </div>
                  <button
                    type="button"
                    onClick={generateWithAI}
                    disabled={aiBusy || !form.title.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                  >
                    {aiBusy ? 'Bezig... (kan 30s duren)' : '✨ Genereer met AI'}
                  </button>
                </div>
                <input
                  className="input-field text-xs"
                  placeholder="Extra wensen (optioneel) bv. 'focus op DIY proces' of 'noem dat het beeldje 6 weken duurt'"
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                  disabled={aiBusy}
                />
                {aiError && <p className="text-xs text-red-600">{aiError}</p>}
                {form.content && form.content.length > 100 && (
                  <p className="text-[11px] text-purple-600 italic">Let op: bestaande content wordt overschreven.</p>
                )}
              </div>
              <div>
                <label className="label">
                  Content *
                  <span className="text-[10px] font-normal text-gravida-light-sage ml-1">
                    (Markdown: **vet**, *cursief*, ## koppen, [link](url), &gt; quote, &gt;_lijst)
                  </span>
                </label>
                <textarea rows={14} className="input-field font-mono text-sm"
                  placeholder="Schrijf je verhaal hier in Markdown..."
                  value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Categorie</label>
                  <input className="input-field" placeholder="bv. zwangerschap"
                    value={form.category ?? ''} onChange={e => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <label className="label">Auteur</label>
                  <input className="input-field" value={form.author ?? ''} onChange={e => setForm({ ...form, author: e.target.value })} />
                </div>
                <div>
                  <label className="label">Tags (komma-gescheiden)</label>
                  <input className="input-field" placeholder="3d scan, beeldje, tip"
                    value={tagsText} onChange={e => setTagsText(e.target.value)} />
                </div>
              </div>
              <details className="border border-gravida-cream rounded-lg p-3 bg-gravida-off-white">
                <summary className="cursor-pointer text-sm font-semibold text-gravida-green">
                  🔍 SEO & AI-vindbaarheid (geavanceerd)
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Focus-keyword</label>
                      <input className="input-field" placeholder="bv. 3d zwangerschapsscan haarlem"
                        value={form.focus_keyword ?? ''} onChange={e => setForm({ ...form, focus_keyword: e.target.value })} />
                      <p className="text-[10px] text-gravida-light-sage mt-1">De zoekterm waarop deze post moet ranken.</p>
                    </div>
                    <div>
                      <label className="label">Verwante zoektermen (komma-gescheiden)</label>
                      <input className="input-field" placeholder="3d echo, 4d scan, pretecho"
                        value={(form.related_keywords ?? []).join(', ')}
                        onChange={e => setForm({ ...form, related_keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">
                      Meta titel <span className="text-[10px] font-normal text-gravida-light-sage">({(form.meta_title ?? '').length}/65 tekens, ideaal 50-65)</span>
                    </label>
                    <input className="input-field" maxLength={70} value={form.meta_title ?? ''}
                      onChange={e => setForm({ ...form, meta_title: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">
                      Meta description <span className="text-[10px] font-normal text-gravida-light-sage">({(form.meta_description ?? '').length}/160 tekens, ideaal 140-160)</span>
                    </label>
                    <textarea rows={2} className="input-field" maxLength={180} value={form.meta_description ?? ''}
                      onChange={e => setForm({ ...form, meta_description: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">
                      Key takeaway <span className="text-[10px] font-normal text-gravida-light-sage">(citeerbare 1-2 zin, wat AI graag pakt)</span>
                    </label>
                    <textarea rows={2} className="input-field" value={form.key_takeaway ?? ''}
                      onChange={e => setForm({ ...form, key_takeaway: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">FAQ (voor AI-vindbaarheid + FAQ schema)</label>
                    <div className="space-y-2">
                      {(form.faq_json ?? []).map((item, idx) => (
                        <div key={idx} className="bg-white border border-gravida-cream rounded-lg p-2 space-y-1">
                          <div className="flex gap-2 items-start">
                            <input className="input-field flex-1 text-sm" placeholder="Vraag"
                              value={item.question}
                              onChange={e => {
                                const next = [...(form.faq_json ?? [])]
                                next[idx] = { ...next[idx], question: e.target.value }
                                setForm({ ...form, faq_json: next })
                              }} />
                            <button type="button" onClick={() => {
                              const next = [...(form.faq_json ?? [])]
                              next.splice(idx, 1)
                              setForm({ ...form, faq_json: next })
                            }} className="text-red-500 hover:text-red-700 text-sm px-1">✕</button>
                          </div>
                          <textarea rows={2} className="input-field text-sm" placeholder="Antwoord (zelfstandig leesbaar, 40-80 woorden)"
                            value={item.answer}
                            onChange={e => {
                              const next = [...(form.faq_json ?? [])]
                              next[idx] = { ...next[idx], answer: e.target.value }
                              setForm({ ...form, faq_json: next })
                            }} />
                        </div>
                      ))}
                      <button type="button" onClick={() => setForm({ ...form, faq_json: [...(form.faq_json ?? []), { question: '', answer: '' }] })}
                        className="text-xs text-gravida-sage hover:text-gravida-green">+ FAQ vraag toevoegen</button>
                    </div>
                  </div>
                </div>
              </details>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} />
                <span>Gepubliceerd (zichtbaar op de website)</span>
              </label>
              <div className="flex gap-2 justify-end pt-2">
                {editingId && (
                  <button onClick={() => remove(editingId)} className="btn-danger mr-auto">Verwijderen</button>
                )}
                <button onClick={() => setShowEditor(false)} className="btn-secondary">Annuleren</button>
                <button onClick={save} disabled={!form.title.trim() || !form.content.trim()} className="btn-primary">
                  {editingId ? 'Opslaan' : 'Aanmaken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
