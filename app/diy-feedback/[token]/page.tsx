'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Rental {
  id: number
  first_name: string
  last_name: string
  email: string
  scanner_issues: string | null
  scan_preference: string | null
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
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/diy-feedback/${token}`).then(r => r.json()).then(data => {
      if (data.error) { setError(data.error); return }
      setRental(data.rental)
      if (data.rental.feedback_submitted_at) setSubmitted(true)
      if (data.rental.scanner_issues) setScannerIssues(data.rental.scanner_issues)
      if (data.rental.scan_preference) setScanPreference(data.rental.scan_preference)
    }).catch(err => setError(String(err))).finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/diy-feedback/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanner_issues: scannerIssues.trim() || null,
          scan_preference: scanPreference.trim() || null,
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
            Bedankt voor je terugkoppeling. Zodra de scanner bij ons binnen is, krijg je daar bericht van.
            Daarna gaan we de scans rustig doornemen en renderen we standaard de twee mooiste scans, zodat je een goed beeld krijgt.
            Zodra de voorvertoning klaar is, ontvang je deze van ons per mail.
          </p>
          <p className="text-sm text-gravida-light-sage">Met vriendelijke groet, Laila</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8">
        <h1 className="text-2xl font-bold text-gravida-green mb-2">DIY scanner - twee korte vragen</h1>
        <p className="text-sm text-gravida-sage mb-6">
          Hi {rental.first_name}, hopelijk heb je een fijne scansessie gehad. Twee korte vragen voordat je de scanner terugstuurt.
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
              Heb je al een voorkeur voor bepaalde scans?
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

          <div className="bg-gravida-off-white rounded-xl border border-gravida-cream p-4 text-sm text-gravida-sage leading-relaxed">
            <p className="font-medium text-gravida-green mb-1">Hoe gaat het verder?</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Stuur de scanner uiterlijk vandaag retour.</li>
              <li>Zodra de scanner bij ons binnen is, krijg je daar bevestiging van.</li>
              <li>We renderen standaard de twee mooiste scans en sturen je een voorvertoning.</li>
              <li>In dat formulier kies je dan je favoriete scan en geef je aan wat je met je aanbetaling wilt doen.</li>
            </ol>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full py-3 rounded-xl bg-gravida-green text-white font-medium hover:bg-gravida-sage transition-colors disabled:opacity-50">
            {submitting ? 'Verzenden...' : 'Verzenden'}
          </button>
        </form>
      </div>
    </div>
  )
}
