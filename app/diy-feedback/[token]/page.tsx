'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Rental {
  id: number
  first_name: string
  last_name: string
  email: string
  scanner_issues: string | null
  deposit_choice: string | null
  feedback_submitted_at: string | null
}

export default function DiyFeedbackPage() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rental, setRental] = useState<Rental | null>(null)

  const [scannerIssues, setScannerIssues] = useState('')
  const [scanPreference, setScanPreference] = useState('')
  const [depositChoice, setDepositChoice] = useState<'order_credit' | 'giftcard' | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/diy-feedback/${token}`).then(r => r.json()).then(data => {
      if (data.error) { setError(data.error); return }
      setRental(data.rental)
      if (data.rental.feedback_submitted_at) setSubmitted(true)
      if (data.rental.scanner_issues) setScannerIssues(data.rental.scanner_issues)
      if (data.rental.scan_preference) setScanPreference(data.rental.scan_preference)
      if (data.rental.deposit_choice && (data.rental.deposit_choice === 'giftcard' || data.rental.deposit_choice === 'order_credit')) {
      setDepositChoice(data.rental.deposit_choice)
    }
    }).catch(err => setError(String(err))).finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depositChoice) {
      setError('Maak een keuze voor je borg.')
      return
    }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/diy-feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanner_issues: scannerIssues.trim() || null,
          scan_preference: scanPreference.trim() || null,
          deposit_choice: depositChoice,
        }),
      })
      if (res.ok) setSubmitted(true)
      else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Er ging iets mis.')
      }
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="p-12 text-center text-sm text-gravida-light-sage">Laden...</div>

  if (error && !rental) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!rental) return null

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8 text-center">
          <h1 className="text-2xl font-bold text-gravida-green mb-3">Helemaal goed</h1>
          <p className="text-gravida-sage mb-6">
            Bedankt voor je terugkoppeling. Zodra de scanner retour is, handelen we de borg voor je af zoals je hebt aangegeven.
          </p>
          <p className="text-sm text-gravida-light-sage">Team Gravida</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8">
        <h1 className="text-2xl font-bold text-gravida-green mb-2">DIY scanner - twee korte vragen</h1>
        <p className="text-sm text-gravida-sage mb-6">
          Hi {rental.first_name}, hopelijk heb je een fijne scansessie gehad. Twee korte vragen voor we de borg afhandelen.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Bijzonderheden */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Heb je bijzonderheden ervaren bij het gebruik van de scanner?
            </label>
            <textarea rows={3}
              className="w-full text-sm px-3 py-2 border border-gravida-cream rounded-lg focus:outline-none focus:border-gravida-sage"
              placeholder="Bijv. een knopje deed het niet helemaal, of alles werkte juist perfect... Laat het ons even weten!"
              value={scannerIssues}
              onChange={e => setScannerIssues(e.target.value)} />
            <p className="text-[11px] text-gravida-light-sage mt-1">Optioneel.</p>
          </div>

          {/* Voorkeur voor scan */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Heb je een voorkeur voor een specifieke scan?
            </label>
            <textarea rows={3}
              className="w-full text-sm px-3 py-2 border border-gravida-cream rounded-lg focus:outline-none focus:border-gravida-sage"
              placeholder="Bijv. de scan met armen, de scan zonder armen, of de eerste scan zonder beweging. Laat dit leeg als je het aan ons overlaat."
              value={scanPreference}
              onChange={e => setScanPreference(e.target.value)} />
            <p className="text-[11px] text-gravida-light-sage mt-1">
              Optioneel. Laat je het leeg, dan kiezen wij de twee mooiste scans uit en sturen we je daarvan een voorvertoning.
            </p>
          </div>

          {/* Borg keuze */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Hoe wil je je aanbetaling van &euro;200 verwerken?
            </label>
            <p className="text-xs text-gravida-sage mb-3 leading-relaxed">
              Het lenen van de scanner is gratis, je betaalt enkel voor het beeldje. Je aanbetaling verrekenen we met je beeldje. Wil je geen beeldje? Dan zetten we een deel om in een cadeaubon en storten we de borg terug.
            </p>
            <div className="space-y-2">
              <button type="button" onClick={() => setDepositChoice('order_credit')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${depositChoice === 'order_credit' ? 'border-gravida-sage bg-gravida-sage/10' : 'border-gravida-cream hover:border-gravida-sage/50'}`}>
                <div className="font-medium text-gravida-green text-sm">Verrekenen met bestelling van een beeldje</div>
                <div className="text-xs text-gravida-sage mt-0.5 leading-relaxed">
                  Je bestelt een beeldje en wij verrekenen je aanbetaling met de prijs.
                </div>
              </button>

              <button type="button" onClick={() => setDepositChoice('giftcard')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${depositChoice === 'giftcard' ? 'border-amber-500 bg-amber-50' : 'border-gravida-cream hover:border-amber-300'}`}>
                <div className="font-medium text-gravida-green text-sm">Cadeaubon (geen beeldje)</div>
                <div className="text-xs text-gravida-sage mt-0.5 leading-relaxed">
                  We zetten een deel van je aanbetaling om in een cadeaubon en storten de borg naar je terug.
                  De cadeaubon is twee jaar geldig en is te gebruiken voor een beeldje, scan of als cadeau voor iemand anders.
                </div>
              </button>
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={submitting || !depositChoice}
            className="w-full py-3 rounded-xl bg-gravida-green text-white font-medium hover:bg-gravida-sage transition-colors disabled:opacity-50">
            {submitting ? 'Verzenden...' : 'Verzenden'}
          </button>
        </form>
      </div>
    </div>
  )
}
