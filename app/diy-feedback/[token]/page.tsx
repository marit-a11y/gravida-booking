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
  const [depositChoice, setDepositChoice] = useState<'refund' | 'order_credit' | 'giftcard' | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/diy-feedback/${token}`).then(r => r.json()).then(data => {
      if (data.error) { setError(data.error); return }
      setRental(data.rental)
      if (data.rental.feedback_submitted_at) setSubmitted(true)
      if (data.rental.scanner_issues) setScannerIssues(data.rental.scanner_issues)
      if (data.rental.deposit_choice) setDepositChoice(data.rental.deposit_choice)
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
            <textarea rows={4}
              className="w-full text-sm px-3 py-2 border border-gravida-cream rounded-lg focus:outline-none focus:border-gravida-sage"
              placeholder="Bijv. een knopje deed het niet helemaal, of alles werkte juist perfect... Laat het ons even weten!"
              value={scannerIssues}
              onChange={e => setScannerIssues(e.target.value)} />
            <p className="text-[11px] text-gravida-light-sage mt-1">Optioneel.</p>
          </div>

          {/* Borg keuze */}
          <div>
            <label className="text-sm font-medium text-gravida-green mb-2 block">
              Hoe wil je dat we je borg van &euro;200 verwerken?
            </label>
            <div className="space-y-2">
              <button type="button" onClick={() => setDepositChoice('refund')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${depositChoice === 'refund' ? 'border-gravida-sage bg-gravida-sage/10' : 'border-gravida-cream hover:border-gravida-sage/50'}`}>
                <div className="font-medium text-gravida-green text-sm">Terugstorten naar mijn rekening</div>
                <div className="text-xs text-gravida-sage mt-0.5">Je krijgt de volledige &euro;200 binnen enkele werkdagen retour.</div>
              </button>

              <button type="button" onClick={() => setDepositChoice('order_credit')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${depositChoice === 'order_credit' ? 'border-gravida-sage bg-gravida-sage/10' : 'border-gravida-cream hover:border-gravida-sage/50'}`}>
                <div className="font-medium text-gravida-green text-sm">Verrekenen met bestelling van een beeldje</div>
                <div className="text-xs text-gravida-sage mt-0.5">Bestel je een beeldje? Dan trekken we de &euro;200 van de prijs af.</div>
              </button>

              <button type="button" onClick={() => setDepositChoice('giftcard')}
                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${depositChoice === 'giftcard' ? 'border-amber-500 bg-amber-50' : 'border-gravida-cream hover:border-amber-300'}`}>
                <div className="font-medium text-gravida-green text-sm">Omzetten in een cadeaubon</div>
                <div className="text-xs text-gravida-sage mt-0.5 leading-relaxed">
                  We zetten <strong>&euro;100</strong> van je borg om in een cadeaubon, de andere <strong>&euro;100</strong> storten we naar je rekening terug.
                  Een leuk cadeau om door te geven, of bewaar 'm voor jezelf voor een toekomstige scan of beeldje. Twee jaar geldig.
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
