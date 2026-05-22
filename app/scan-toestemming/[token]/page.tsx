'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { findMaterial, findFinishLabel } from '@/lib/scan-options'

interface Consent {
  id: number
  token: string
  material: string | null
  finish: string | null
  size: string | null
  size_other: string | null
  with_arms: boolean | null
  weighted: boolean | null
  consent_storage_files: boolean | null
  consent_marketing_use: boolean | null
  consent_interview: boolean | null
  shipping_insured: boolean | null
  digital_wishes: string | null
  shared_notes: string | null
  preferred_scan_number: number | null
  submitted_at: string | null
}

export default function ScanConsentPage() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState<Consent | null>(null)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [customerNumber, setCustomerNumber] = useState<string | null>(null)

  // Antwoorden
  const [storageFiles, setStorageFiles] = useState<boolean | null>(null)
  const [marketingUse, setMarketingUse] = useState<boolean | null>(null)
  const [interviewOk, setInterviewOk] = useState<boolean | null>(null)
  const [shippingInsured, setShippingInsured] = useState<boolean | null>(null)
  const [preferredScan, setPreferredScan] = useState<number | null>(null)
  const [digitalWishes, setDigitalWishes] = useState('')
  const [sharedNotes, setSharedNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/scan-consent/${token}`).then(r => r.json()).then(data => {
      if (data.error) { setError(data.error); return }
      setConsent(data.consent)
      setFirstName(data.first_name)
      setCustomerNumber(data.customer_number ?? null)
      if (data.consent.submitted_at) setSubmitted(true)
      if (data.consent.preferred_scan_number) setPreferredScan(data.consent.preferred_scan_number)
      // Pre-fill als al eens ingevuld
      if (data.consent.consent_storage_files !== null) setStorageFiles(data.consent.consent_storage_files)
      if (data.consent.consent_marketing_use !== null) setMarketingUse(data.consent.consent_marketing_use)
      if (data.consent.consent_interview !== null && data.consent.consent_interview !== undefined) setInterviewOk(data.consent.consent_interview)
      if (data.consent.shipping_insured !== null) setShippingInsured(data.consent.shipping_insured)
      if (data.consent.digital_wishes) setDigitalWishes(data.consent.digital_wishes)
      if (data.consent.shared_notes) setSharedNotes(data.consent.shared_notes)
    }).catch(err => setError(String(err))).finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (storageFiles === null || marketingUse === null || interviewOk === null || shippingInsured === null) {
      setError('Beantwoord alle vragen.')
      return
    }
    if (!preferredScan) {
      setError('Geef aan welke scan je voorkeur heeft.')
      return
    }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/scan-consent/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent_storage_files: storageFiles,
          consent_marketing_use: marketingUse,
          consent_interview: interviewOk,
          shipping_insured: shippingInsured,
          digital_wishes: digitalWishes.trim() || null,
          shared_notes: sharedNotes.trim() || null,
          preferred_scan_number: preferredScan,
        }),
      })
      if (res.ok) setSubmitted(true)
      else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Er ging iets mis.')
      }
    } finally { setSubmitting(false) }
  }

  if (loading) {
    return <div className="p-12 text-center text-sm text-gravida-light-sage">Laden...</div>
  }

  if (error && !consent) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!consent) return null

  const materialLabel = consent.material ? (findMaterial(consent.material)?.label ?? consent.material) : null
  const finishLabel = consent.material && consent.finish ? findFinishLabel(consent.material, consent.finish) : null
  const sizeLabel = consent.size === 'Anders, namelijk...' && consent.size_other
    ? `Anders: ${consent.size_other}`
    : consent.size

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8 text-center">
          <p className="text-5xl mb-4">✨</p>
          <h1 className="text-2xl font-bold text-gravida-green mb-3">Helemaal goed!</h1>
          <p className="text-gravida-sage mb-6">
            Je antwoorden zijn ontvangen. We gaan voor je aan de slag met de bewerking en productie van je beeldje.
            Je krijgt vanzelf bericht zodra het klaar is.
          </p>
          <p className="text-sm text-gravida-light-sage">Team Gravida</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8">
        <h1 className="text-2xl font-bold text-gravida-green mb-2">📝 Bevestig je keuzes</h1>
        {firstName && (
          <p className="text-sm text-gravida-sage mb-6">
            Hi {firstName}! Hieronder zie je de afspraken die we samen hebben gemaakt en nog drie korte vragen.
          </p>
        )}

        {/* Overzicht keuzes */}
        {(materialLabel || finishLabel || sizeLabel || consent.with_arms !== null || consent.weighted !== null) && (
          <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-4 mb-6">
            <p className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide mb-2">
              Onze afspraken voor jouw beeldje
            </p>
            <table className="w-full text-sm">
              <tbody>
                {materialLabel && <tr><td className="py-1 text-gravida-light-sage w-32">🎨 Materiaal</td><td className="py-1 text-gravida-green">{materialLabel}</td></tr>}
                {finishLabel && <tr><td className="py-1 text-gravida-light-sage">✨ Afwerking</td><td className="py-1 text-gravida-green">{finishLabel}</td></tr>}
                {sizeLabel && <tr><td className="py-1 text-gravida-light-sage">📏 Grootte</td><td className="py-1 text-gravida-green">{sizeLabel}</td></tr>}
                {consent.with_arms !== null && <tr><td className="py-1 text-gravida-light-sage">🤱 Met armen</td><td className="py-1 text-gravida-green">{consent.with_arms ? 'Ja' : 'Nee'}</td></tr>}
                {consent.weighted !== null && <tr><td className="py-1 text-gravida-light-sage">⚖️ Verzwaren</td><td className="py-1 text-gravida-green">{consent.weighted ? 'Ja' : 'Nee'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Voorkeur scan */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Welke scan heeft je voorkeur?
            </label>
            <p className="text-xs text-gravida-sage leading-relaxed mb-2">
              We hebben twee scans voor je uitgezocht. Kies welke je wilt laten produceren.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPreferredScan(1)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${preferredScan === 1 ? 'border-gravida-sage bg-gravida-sage text-white' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Scan {customerNumber ? customerNumber + '-1' : '1'}
              </button>
              <button type="button" onClick={() => setPreferredScan(2)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${preferredScan === 2 ? 'border-gravida-sage bg-gravida-sage text-white' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Scan {customerNumber ? customerNumber + '-2' : '2'}
              </button>
            </div>
          </div>

          {/* Toestemming opslaan */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Mogen wij jouw bestanden na productie bewaren voor eventuele nabestellingen?
            </label>
            <p className="text-xs text-gravida-sage leading-relaxed mb-2">
              Handig voor het geval je beeldje stuk valt of beschadigd raakt, dan kunnen we makkelijk een nieuwe maken zonder dat we opnieuw moeten scannen.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStorageFiles(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${storageFiles === true ? 'border-gravida-sage bg-gravida-sage text-white' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Ja graag
              </button>
              <button type="button" onClick={() => setStorageFiles(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${storageFiles === false ? 'border-red-400 bg-red-50 text-red-700' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Nee, liever niet
              </button>
            </div>
          </div>

          {/* Marketing use */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Mogen we foto&apos;s van jouw beeldje delen op social media en voor andere marketingdoeleinden?
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMarketingUse(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${marketingUse === true ? 'border-gravida-sage bg-gravida-sage text-white' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Ja graag
              </button>
              <button type="button" onClick={() => setMarketingUse(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${marketingUse === false ? 'border-red-400 bg-red-50 text-red-700' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Liever niet
              </button>
            </div>
          </div>

          {/* Interview */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Sta je open voor een interview voor ons magazine of social media?
            </label>
            <p className="text-xs text-gravida-sage leading-relaxed mb-2">
              We nemen hierover vooraf altijd persoonlijk contact met je op, dit is alleen een eerste &lsquo;wel/niet interesse&rsquo;. Geen verplichtingen.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setInterviewOk(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${interviewOk === true ? 'border-gravida-sage bg-gravida-sage text-white' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Ja, leuk
              </button>
              <button type="button" onClick={() => setInterviewOk(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${interviewOk === false ? 'border-red-400 bg-red-50 text-red-700' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Liever niet
              </button>
            </div>
          </div>

          {/* Verzending */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Verzending
            </label>
            <p className="text-xs text-gravida-sage leading-relaxed mb-3">
              Verzending is standaard <strong>inclusief</strong>. Daarnaast bieden we de optie om je beeldje <strong>verzekerd</strong> te verzenden voor &euro;15. Kunst is namelijk niet te verzekeren via de koeriersdienst, daarom hebben we hiervoor onze eigen verzekering. Komt het beeldje stuk of beschadigd aan, dan maken of herstellen we het kosteloos opnieuw voor je.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShippingInsured(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${shippingInsured === true ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-gravida-cream text-gravida-sage hover:border-amber-300'}`}>
                Ja, verzekerd verzenden (+&euro;15)
              </button>
              <button type="button" onClick={() => setShippingInsured(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border-2 transition-colors ${shippingInsured === false ? 'border-gravida-light-sage bg-gravida-cream text-gravida-sage' : 'border-gravida-cream text-gravida-sage hover:border-gravida-sage/50'}`}>
                Nee, standaard verzenden
              </button>
            </div>
          </div>

          {/* Digitale nabewerking wensen */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Wensen voor digitale nabewerking (optioneel)
            </label>
            <p className="text-xs text-gravida-sage leading-relaxed mb-2">
              Standaard werken we je beeldje &lsquo;smooth&rsquo; af, waarbij we alles onder de buik gladtrekken: details in de schaamstreek en eventueel zichtbare cellulitis. Wil je andere bewerkingen, of juist géén standaard smooth-afwerking? Geef het hier door.
            </p>
            <textarea
              rows={3}
              className="w-full text-sm px-3 py-2 border border-gravida-cream rounded-lg focus:outline-none focus:border-gravida-sage"
              placeholder="Bijv. moedervlek mag blijven, navelpiercing weghalen, tatoeage versterken, of: liever geen standaard smooth"
              value={digitalWishes}
              onChange={e => setDigitalWishes(e.target.value)}
            />
          </div>

          {/* Overige afspraken */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Overige opmerkingen / afspraken (optioneel)
            </label>
            <textarea
              rows={3}
              className="w-full text-sm px-3 py-2 border border-gravida-cream rounded-lg focus:outline-none focus:border-gravida-sage"
              placeholder="Bijv. afhalen i.p.v. verzenden, levering iets later, etc."
              value={sharedNotes}
              onChange={e => setSharedNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl bg-gravida-green text-white font-medium hover:bg-gravida-sage transition-colors disabled:opacity-50">
            {submitting ? 'Verzenden...' : 'Verzenden'}
          </button>
        </form>

        {/* Webshop verwijzing , feestelijk */}
        <div className="mt-10 -mx-8 -mb-8 px-8 py-8 rounded-b-2xl bg-gradient-to-br from-gravida-cream to-amber-50 border-t border-gravida-cream text-center">
          <p className="text-2xl mb-2">✨</p>
          <h2 className="text-xl font-bold text-gravida-green mb-2">
            Nu het leuke werk: kies jouw mooiste beeldje
          </h2>
          <p className="text-sm text-gravida-sage leading-relaxed mb-5 max-w-md mx-auto">
            Neem rustig de tijd om door onze collectie zwangerschapsbeeldjes te bladeren en kies het beeldje
            dat jij het mooist vindt. Vermeld bij je bestelling je klant, en scannummer, dan verrekenen wij
            je aanbetaling automatisch.
          </p>
          <a href="https://gravida.nl/product-categorie/beelden/zwangerschapsbeeldje"
            target="_blank" rel="noopener noreferrer"
            className="inline-block px-8 py-4 rounded-xl bg-gravida-green text-white font-semibold text-base shadow-sm hover:bg-gravida-sage transition-colors">
            Bekijk de beeldjes
          </a>
        </div>
      </div>
    </div>
  )
}
