'use client'

import { useEffect, useState } from 'react'
import { MATERIALS, SIZES, findMaterial, findFinishLabel } from '@/lib/scan-options'

interface Consent {
  id: number
  token: string
  material: string | null
  finish: string | null
  size: string | null
  size_other: string | null
  with_arms: boolean | null
  weighted: boolean | null
  internal_notes: string | null
  consent_storage_files: boolean | null
  consent_marketing_use: boolean | null
  shipping_insured: boolean | null
  digital_wishes: string | null
  shared_notes: string | null
  sent_at: string | null
  submitted_at: string | null
}

interface Props {
  bookingId?: number
  diyRentalId?: number
}

export function ScanConsentSection({ bookingId, diyRentalId }: Props) {
  const [consent, setConsent] = useState<Consent | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // Form state
  const [material, setMaterial] = useState('')
  const [finish, setFinish] = useState('')
  const [size, setSize] = useState('')
  const [sizeOther, setSizeOther] = useState('')
  const [withArms, setWithArms] = useState<boolean | null>(null)
  const [weighted, setWeighted] = useState<boolean | null>(null)
  const [internalNotes, setInternalNotes] = useState('')
  const [digitalWishesAdmin, setDigitalWishesAdmin] = useState('')
  const [sharedNotes, setSharedNotes] = useState('')

  const idQuery = bookingId
    ? `booking_id=${bookingId}`
    : `diy_rental_id=${diyRentalId}`

  useEffect(() => {
    if (!bookingId && !diyRentalId) return
    fetch(`/api/admin/scan-consents?${idQuery}`)
      .then(r => r.json())
      .then(data => {
        if (data.consent) {
          setConsent(data.consent)
          setMaterial(data.consent.material ?? '')
          setFinish(data.consent.finish ?? '')
          setSize(data.consent.size ?? '')
          setSizeOther(data.consent.size_other ?? '')
          setWithArms(data.consent.with_arms)
          setWeighted(data.consent.weighted)
          setInternalNotes(data.consent.internal_notes ?? '')
          setDigitalWishesAdmin(data.consent.digital_wishes ?? '')
          setSharedNotes(data.consent.shared_notes ?? '')
        }
      })
      .finally(() => setLoading(false))
  }, [bookingId, diyRentalId, idQuery])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/scan-consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: bookingId, diy_rental_id: diyRentalId,
          material: material || null,
          finish: finish || null,
          size: size || null,
          size_other: size === 'Anders, namelijk...' ? sizeOther : null,
          with_arms: withArms,
          weighted,
          internal_notes: internalNotes || null,
          digital_wishes: digitalWishesAdmin || null,
          shared_notes: sharedNotes || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setConsent(data.consent)
        setEditing(false)
      } else {
        alert('Opslaan mislukt')
      }
    } finally { setSaving(false) }
  }

  const sendEmail = async () => {
    if (!consent) {
      await save()  // sla eerst op
    }
    if (!consent) return
    if (!confirm('Verstuur het toestemmingsformulier naar de klant?')) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/scan-consents/${consent.id}/send-email`, { method: 'POST' })
      if (res.ok) {
        alert('Toestemmingsmail verstuurd ✓')
        // refresh consent to get sent_at
        const r = await fetch(`/api/admin/scan-consents?${idQuery}`)
        const data = await r.json()
        if (data.consent) setConsent(data.consent)
      } else {
        const data = await res.json().catch(() => ({}))
        alert('Verzenden mislukt: ' + (data.error ?? ''))
      }
    } finally { setSending(false) }
  }

  if (loading) return <p className="text-xs text-gravida-light-sage italic">Laden scan-keuzes...</p>

  const selectedMat = material ? findMaterial(material) : null
  const finishLabelText = consent?.finish && consent?.material
    ? findFinishLabel(consent.material, consent.finish)
    : null

  // Read-only weergave als ingevuld én niet aan het bewerken
  if (consent && !editing) {
    return (
      <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <p className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide">
            📝 Scan-toestemming
          </p>
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(true)}
              className="text-[11px] px-2 py-1 rounded bg-white border border-gravida-cream hover:border-gravida-sage">
              ✏️ Bewerken
            </button>
            <button onClick={sendEmail} disabled={sending}
              className="text-[11px] px-2 py-1 rounded bg-gravida-sage text-white hover:bg-gravida-green disabled:opacity-50">
              {sending ? 'Bezig...' : consent.sent_at ? '🔁 Opnieuw versturen' : '📧 Verstuur mail'}
            </button>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          {consent.material && <div><span className="text-gravida-light-sage">Materiaal:</span> {findMaterial(consent.material)?.label ?? consent.material}</div>}
          {finishLabelText && <div><span className="text-gravida-light-sage">Afwerking:</span> {finishLabelText}</div>}
          {consent.size && <div><span className="text-gravida-light-sage">Grootte:</span> {consent.size === 'Anders, namelijk...' ? consent.size_other : consent.size}</div>}
          {consent.with_arms !== null && <div><span className="text-gravida-light-sage">Met armen:</span> {consent.with_arms ? 'Ja' : 'Nee'}</div>}
          {consent.weighted !== null && <div><span className="text-gravida-light-sage">Verzwaren:</span> {consent.weighted ? 'Ja' : 'Nee'}</div>}
          {consent.digital_wishes && !consent.submitted_at && (
            <div className="italic text-gravida-sage mt-1">💬 Wensen digitaal: {consent.digital_wishes}</div>
          )}
          {consent.shared_notes && !consent.submitted_at && (
            <div className="italic text-gravida-sage mt-1">📋 Overige afspraken: {consent.shared_notes}</div>
          )}
          {consent.internal_notes && <div className="italic text-amber-700 mt-1">📌 {consent.internal_notes}</div>}
        </div>
        <div className="mt-2 pt-2 border-t border-gravida-cream/70 flex flex-wrap gap-2 text-[11px]">
          <span className={consent.sent_at ? 'text-green-700' : 'text-gravida-light-sage'}>
            {consent.sent_at ? `📤 Verstuurd ${new Date(consent.sent_at).toLocaleDateString('nl-NL')}` : '📭 Nog niet verstuurd'}
          </span>
          <span className={consent.submitted_at ? 'text-green-700 font-medium' : 'text-gravida-light-sage'}>
            {consent.submitted_at ? `✓ Klant heeft ingevuld ${new Date(consent.submitted_at).toLocaleDateString('nl-NL')}` : '⏳ Wacht op klant'}
          </span>
        </div>
        {consent.submitted_at && (
          <div className="mt-3 pt-3 border-t border-gravida-cream/70 space-y-1 text-xs">
            <p className="font-medium text-gravida-green mb-1">Antwoorden klant:</p>
            <div>📦 Bestanden opslaan: <span className={consent.consent_storage_files ? 'text-green-700' : 'text-red-600'}>{consent.consent_storage_files ? 'Ja' : 'Nee'}</span></div>
            <div>📸 Foto&apos;s gebruiken: <span className={consent.consent_marketing_use ? 'text-green-700' : 'text-red-600'}>{consent.consent_marketing_use ? 'Ja' : 'Nee'}</span></div>
            <div>🛡️ Verzekerd verzenden (€15): <span className={consent.shipping_insured ? 'text-green-700' : 'text-red-600'}>{consent.shipping_insured ? 'Ja' : 'Nee'}</span></div>
            {consent.digital_wishes && <div className="mt-1">💬 Wensen: <span className="italic">{consent.digital_wishes}</span></div>}
            {consent.shared_notes && <div className="mt-1">📋 Afspraken: <span className="italic">{consent.shared_notes}</span></div>}
          </div>
        )}
      </div>
    )
  }

  // Edit form
  return (
    <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide">
          📝 Scan-toestemming invullen
        </p>
        {consent && (
          <button onClick={() => setEditing(false)}
            className="text-[11px] text-gravida-light-sage hover:text-gravida-sage">
            ✕ annuleren
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-gravida-light-sage block mb-1">Materiaal</label>
          <select className="w-full text-sm border border-gravida-cream rounded px-2 py-1.5"
            value={material} onChange={e => { setMaterial(e.target.value); setFinish('') }}>
            <option value="">— kies —</option>
            {MATERIALS.map(m => <option key={m.code} value={m.code}>{m.code} — {m.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gravida-light-sage block mb-1">
            {selectedMat?.finishLabel ?? 'Afwerking'}
          </label>
          <select className="w-full text-sm border border-gravida-cream rounded px-2 py-1.5"
            value={finish} onChange={e => setFinish(e.target.value)} disabled={!selectedMat}>
            <option value="">— kies —</option>
            {selectedMat?.finishes.map(f => (
              <option key={f.code} value={f.code}>
                {f.code} — {f.label}{f.surcharge ? ` (+€${f.surcharge})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gravida-light-sage block mb-1">Grootte</label>
          <select className="w-full text-sm border border-gravida-cream rounded px-2 py-1.5"
            value={size} onChange={e => setSize(e.target.value)}>
            <option value="">— kies —</option>
            {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {size === 'Anders, namelijk...' && (
          <div>
            <label className="text-[11px] text-gravida-light-sage block mb-1">Anders, namelijk</label>
            <input className="w-full text-sm border border-gravida-cream rounded px-2 py-1.5"
              value={sizeOther} onChange={e => setSizeOther(e.target.value)} />
          </div>
        )}
        <div>
          <label className="text-[11px] text-gravida-light-sage block mb-1">Met armen (optioneel)</label>
          <div className="flex gap-1">
            {[
              { v: true, l: 'Ja' }, { v: false, l: 'Nee' }, { v: null, l: 'n.v.t.' }
            ].map(o => (
              <button key={String(o.v)} type="button" onClick={() => setWithArms(o.v)}
                className={`flex-1 py-1.5 text-xs rounded border ${withArms === o.v ? 'border-gravida-sage bg-gravida-sage text-white' : 'border-gravida-cream text-gravida-sage'}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-gravida-light-sage block mb-1">Verzwaren (optioneel)</label>
          <div className="flex gap-1">
            {[
              { v: true, l: 'Ja' }, { v: false, l: 'Nee' }, { v: null, l: 'n.v.t.' }
            ].map(o => (
              <button key={String(o.v)} type="button" onClick={() => setWeighted(o.v)}
                className={`flex-1 py-1.5 text-xs rounded border ${weighted === o.v ? 'border-gravida-sage bg-gravida-sage text-white' : 'border-gravida-cream text-gravida-sage'}`}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[11px] text-gravida-light-sage block mb-1">
          💬 Wensen voor digitale nabewerking <span className="text-gravida-sage">(klant ziet dit)</span>
        </label>
        <textarea rows={2} className="w-full text-sm border border-gravida-cream rounded px-2 py-1.5"
          placeholder="Bijv. moedervlek mag blijven, navelpiercing weghalen, tatoeage versterken..."
          value={digitalWishesAdmin} onChange={e => setDigitalWishesAdmin(e.target.value)} />
      </div>

      <div>
        <label className="text-[11px] text-gravida-light-sage block mb-1">
          📋 Overige opmerkingen / afspraken <span className="text-gravida-sage">(klant ziet dit)</span>
        </label>
        <textarea rows={2} className="w-full text-sm border border-gravida-cream rounded px-2 py-1.5"
          placeholder="Bijv. wil eerst proefdruk zien, levering 2 weken later, etc."
          value={sharedNotes} onChange={e => setSharedNotes(e.target.value)} />
      </div>

      <div>
        <label className="text-[11px] text-gravida-light-sage block mb-1">
          📌 Interne notitie <span className="text-amber-700">(alleen team)</span>
        </label>
        <textarea rows={2} className="w-full text-sm border border-gravida-cream rounded px-2 py-1.5 bg-amber-50/40"
          placeholder="Bijv. klant twijfelde over materiaal, gespreksnotitie..."
          value={internalNotes} onChange={e => setInternalNotes(e.target.value)} />
      </div>

      <div className="flex gap-2 justify-end">
        {consent && <button onClick={() => setEditing(false)} className="text-xs px-3 py-1.5 rounded border border-gravida-cream">Annuleren</button>}
        <button onClick={save} disabled={saving}
          className="text-xs px-3 py-1.5 rounded bg-gravida-sage text-white hover:bg-gravida-green disabled:opacity-50">
          {saving ? 'Opslaan...' : consent ? '💾 Opslaan' : '💾 Aanmaken'}
        </button>
      </div>
    </div>
  )
}
