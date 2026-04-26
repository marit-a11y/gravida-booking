'use client'

import { useState, useRef, useEffect } from 'react'

type Bijzonderheid = 'moedervlek' | 'tattoo' | 'sieraden' | 'anders'

type ImageSlot = {
  filename: string
  base64: string
  preview: string
} | null

type PendingRental = {
  id: number
  first_name: string
  last_name: string
  email: string
  rental_week: string
  scanner_name?: string
}

const BIJZONDERHEDEN_OPTIES: { value: Bijzonderheid; label: string }[] = [
  { value: 'moedervlek', label: 'Moedervlek(ken)' },
  { value: 'tattoo',    label: "Tattoo('s)" },
  { value: 'sieraden',  label: 'Sieraden / piercings' },
  { value: 'anders',    label: 'Anders' },
]

export default function DiyBeoordelingPage() {
  // Pending rentals
  const [pendingRentals,  setPendingRentals]  = useState<PendingRental[]>([])
  const [selectedRentalId, setSelectedRentalId] = useState<number | null>(null)

  // Form state
  const [klantNaam,       setKlantNaam]       = useState('')
  const [klantEmail,      setKlantEmail]      = useState('')
  const [bijzonderheden,  setBijzonderheden]  = useState<Bijzonderheid[]>([])
  const [andersTekst,     setAndersTekst]     = useState('')
  const [bruikbaar,       setBruikbaar]       = useState<boolean | null>(null)
  const [extraWensen,     setExtraWensen]     = useState('')
  const [images,          setImages]          = useState<ImageSlot[]>([null, null, null, null])
  const [sending,         setSending]         = useState(false)
  const [sent,            setSent]            = useState(false)
  const [sentNaam,        setSentNaam]        = useState('')
  const [error,           setError]           = useState<string | null>(null)

  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
                    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  // ── Fetch pending rentals ───────────────────────────────────────────────────
  const fetchPending = async () => {
    try {
      const res = await fetch('/api/admin/diy-rentals?status=uitzoeken', { credentials: 'include' })
      if (res.ok) setPendingRentals(await res.json())
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchPending() }, [])

  // ── Select a pending rental → pre-fill ─────────────────────────────────────
  function selectRental(id: number) {
    const r = pendingRentals.find(r => r.id === id)
    if (!r) return
    setSelectedRentalId(id)
    setKlantNaam(`${r.first_name} ${r.last_name}`)
    setKlantEmail(r.email)
    setSent(false)
    setError(null)
  }

  function clearSelection() {
    setSelectedRentalId(null)
    setKlantNaam(''); setKlantEmail('')
  }

  // ── Image handling ──────────────────────────────────────────────────────────
  function handleFileChange(index: number, file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const base64 = dataUrl.split(',')[1]
      const newImages = [...images]
      newImages[index] = { filename: file.name, base64, preview: dataUrl }
      setImages(newImages)
    }
    reader.readAsDataURL(file)
  }

  function removeImage(index: number) {
    const newImages = [...images]
    newImages[index] = null
    setImages(newImages)
    if (fileRefs[index].current) fileRefs[index].current!.value = ''
  }

  function handleDrop(index: number, e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFileChange(index, file)
  }

  // ── Bijzonderheden toggle ───────────────────────────────────────────────────
  function toggleBijzonderheid(val: Bijzonderheid) {
    setBijzonderheden(prev =>
      prev.includes(val) ? prev.filter(b => b !== val) : [...prev, val]
    )
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!klantNaam.trim() || !klantEmail.trim()) {
      setError('Vul naam en e-mailadres in.')
      return
    }
    if (bruikbaar === null) {
      setError('Geef aan of de scan bruikbaar is.')
      return
    }
    if (!bruikbaar) {
      setError('De scan is gemarkeerd als niet bruikbaar. Neem zelf contact op met de klant.')
      return
    }

    const filledImages = images.filter(Boolean) as NonNullable<ImageSlot>[]

    setSending(true)
    try {
      const res = await fetch('/api/admin/diy-beoordeling', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          klant_naam: klantNaam.trim(),
          klant_email: klantEmail.trim(),
          bijzonderheden,
          anders_tekst: andersTekst.trim() || undefined,
          bruikbaar,
          extra_wensen: extraWensen.trim() || undefined,
          images: filledImages.map(img => ({ filename: img.filename, base64: img.base64 })),
          rental_id: selectedRentalId ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Verzenden mislukt')

      setSentNaam(klantNaam.trim())
      setSent(true)

      // Reset form
      setKlantNaam(''); setKlantEmail(''); setBijzonderheden([]); setAndersTekst('')
      setBruikbaar(null); setExtraWensen(''); setImages([null, null, null, null])
      setSelectedRentalId(null)

      // Refresh pending list (rental should now be gone)
      fetchPending()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is iets misgegaan')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Scan beoordeling</h1>
          <p className="text-sm text-gravida-sage mt-1">
            Beoordeel de DIY-scan en verstuur de goedkeuringsmail met screenshots.
          </p>
        </div>
        {pendingRentals.length > 0 && (
          <span className="shrink-0 bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            {pendingRentals.length} in afwachting
          </span>
        )}
      </div>

      {/* ── Pending rentals dropdown ── */}
      {pendingRentals.length > 0 && (
        <div className="card p-5 mb-6 border-l-4 border-l-pink-400">
          <p className="text-sm font-semibold text-gravida-green mb-3">
            Klanten in afwachting van beoordeling
          </p>
          <div className="space-y-2">
            {pendingRentals.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectedRentalId === r.id ? clearSelection() : selectRental(r.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-colors text-sm ${
                  selectedRentalId === r.id
                    ? 'border-gravida-green bg-gravida-green/5'
                    : 'border-gravida-cream hover:border-gravida-sage'
                }`}
              >
                <div>
                  <span className="font-medium text-gravida-green">
                    {r.first_name} {r.last_name}
                  </span>
                  <span className="text-gravida-sage ml-2 text-xs">{r.email}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.scanner_name && (
                    <span className="text-xs text-gravida-light-sage">{r.scanner_name}</span>
                  )}
                  <span className="text-xs text-gravida-light-sage">
                    week {new Date(r.rental_week).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                  {selectedRentalId === r.id && (
                    <span className="text-[10px] bg-gravida-green text-white px-2 py-0.5 rounded-full">Geselecteerd</span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {selectedRentalId && (
            <p className="text-xs text-gravida-sage mt-3">
              ✓ Naam en e-mail zijn ingevuld. Na verzenden wordt de status automatisch bijgewerkt naar <strong>scans uitgezocht</strong>.
            </p>
          )}
        </div>
      )}

      {sent && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-medium">
          ✓ Goedkeuringsmail verzonden naar {sentNaam}.
          <button className="ml-3 underline text-green-700" onClick={() => setSent(false)}>Nieuwe beoordeling</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

        {/* ── Klantgegevens ── */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Klantgegevens</h2>
            {selectedRentalId && (
              <button type="button" onClick={clearSelection} className="text-xs text-gravida-sage hover:text-red-500 transition-colors">
                Selectie wissen
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1">Naam klant *</label>
              <input
                type="text"
                value={klantNaam}
                onChange={e => setKlantNaam(e.target.value)}
                placeholder="bv. Linda Visser"
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="label block mb-1">E-mailadres klant *</label>
              <input
                type="email"
                value={klantEmail}
                onChange={e => setKlantEmail(e.target.value)}
                placeholder="bv. linda@email.nl"
                className="input-field w-full"
                required
              />
            </div>
          </div>
        </div>

        {/* ── Scan bruikbaar ── */}
        <div className="card p-6">
          <h2 className="section-title mb-4">Scan bruikbaar?</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setBruikbaar(true)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                bruikbaar === true
                  ? 'bg-gravida-green text-white border-gravida-green'
                  : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage'
              }`}
            >
              ✓ Ja, goedgekeurd
            </button>
            <button
              type="button"
              onClick={() => setBruikbaar(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-colors ${
                bruikbaar === false
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-gravida-cream text-gravida-sage hover:border-red-300 hover:text-red-600'
              }`}
            >
              ✗ Nee, niet bruikbaar
            </button>
          </div>
          {bruikbaar === false && (
            <p className="mt-3 text-sm text-red-600">
              Er wordt geen automatische mail verzonden. Neem zelf contact op met de klant.
            </p>
          )}
        </div>

        {/* ── Screenshots ── */}
        <div className="card p-6">
          <h2 className="section-title mb-1">Screenshots</h2>
          <p className="text-xs text-gravida-sage mb-4">Voeg maximaal 4 afbeeldingen toe — worden als bijlage meegestuurd.</p>
          <div className="grid grid-cols-2 gap-3">
            {images.map((slot, i) => (
              <div key={i}>
                {slot ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-gravida-cream group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slot.preview} alt={`Scan ${i + 1}`} className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full text-xs font-bold text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >×</button>
                    <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-1 truncate">
                      {slot.filename}
                    </p>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-gravida-cream rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer hover:border-gravida-sage transition-colors"
                    onClick={() => fileRefs[i].current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleDrop(i, e)}
                  >
                    <span className="text-2xl text-gravida-light-sage">+</span>
                    <span className="text-xs text-gravida-light-sage mt-1">Scan {i + 1}</span>
                  </div>
                )}
                <input ref={fileRefs[i]} type="file" accept="image/*" className="hidden"
                  onChange={e => handleFileChange(i, e.target.files?.[0] ?? null)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Bijzonderheden ── */}
        <div className="card p-6">
          <h2 className="section-title mb-1">Bijzonderheden</h2>
          <p className="text-xs text-gravida-sage mb-4">
            Laat leeg als er geen bijzonderheden zijn. De standaard buikbewerking wordt altijd vermeld.
          </p>
          <div className="space-y-3">
            {BIJZONDERHEDEN_OPTIES.map(opt => (
              <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => toggleBijzonderheid(opt.value)}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                    bijzonderheden.includes(opt.value)
                      ? 'bg-gravida-green border-gravida-green'
                      : 'border-gravida-cream group-hover:border-gravida-sage'
                  }`}
                >
                  {bijzonderheden.includes(opt.value) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gravida-green cursor-pointer" onClick={() => toggleBijzonderheid(opt.value)}>
                    {opt.label}
                  </span>
                  {opt.value === 'moedervlek' && bijzonderheden.includes('moedervlek') && (
                    <p className="text-xs text-gravida-sage mt-1 leading-relaxed">
                      Mail: standaard weggewerkt — klant kan aangeven dat ze zichtbaar moeten blijven (worden digitaal verdikt).
                    </p>
                  )}
                  {opt.value === 'tattoo' && bijzonderheden.includes('tattoo') && (
                    <p className="text-xs text-gravida-sage mt-1 leading-relaxed">
                      Mail: standaard weggewerkt — klant kan aangeven dat ze zichtbaar moeten blijven (contouren versterkt).
                    </p>
                  )}
                  {opt.value === 'sieraden' && bijzonderheden.includes('sieraden') && (
                    <p className="text-xs text-gravida-sage mt-1 leading-relaxed">
                      Mail: standaard weggewerkt — klant kan aangeven dat ze zichtbaar moeten blijven (digitaal versterkt).
                    </p>
                  )}
                  {opt.value === 'anders' && bijzonderheden.includes('anders') && (
                    <textarea
                      value={andersTekst}
                      onChange={e => setAndersTekst(e.target.value)}
                      placeholder="Beschrijf de bijzonderheid..."
                      rows={2}
                      className="input-field w-full mt-2 text-sm resize-none"
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                </div>
              </label>
            ))}
          </div>
          {bijzonderheden.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>Disclaimer wordt automatisch toegevoegd:</strong> "We geven vanwege de hoge mate van handwerk geen garantie dat moedervlekken, sieraden, tattoos en piercings zichtbaar blijven, maar doen ons best in het atelier rekening te houden met je voorkeur."
              </p>
            </div>
          )}
        </div>

        {/* ── Extra notitie ── */}
        <div className="card p-6">
          <h2 className="section-title mb-1">
            Aanvullende notitie <span className="text-gravida-light-sage font-normal text-sm">(optioneel)</span>
          </h2>
          <p className="text-xs text-gravida-sage mb-3">Wordt als apart blok in de mail gezet.</p>
          <textarea
            value={extraWensen}
            onChange={e => setExtraWensen(e.target.value)}
            placeholder="bv. Je hebt aangegeven dat je de scan van links wil. We houden hier rekening mee."
            rows={3}
            className="input-field w-full resize-none text-sm"
          />
        </div>

        {/* ── Error & Submit ── */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>
        )}

        <div className="flex items-center gap-4 pb-4">
          <button
            type="submit"
            disabled={sending || bruikbaar !== true}
            className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Verzenden...' : 'Goedkeuringsmail verzenden'}
          </button>
          {bruikbaar !== true && !sending && (
            <p className="text-xs text-gravida-sage">Markeer de scan eerst als goedgekeurd.</p>
          )}
        </div>

      </form>
    </div>
  )
}
