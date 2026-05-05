'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function Content() {
  const searchParams = useSearchParams()
  const rentalId = searchParams.get('id')

  const [message, setMessage] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rentalId) {
      setError('Geen reservering-id gevonden in de link. Open de support call vanuit je e-mail.')
      return
    }
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/diy-support-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rental_id: rentalId,
          message: message.trim() || undefined,
          preferred_time: preferredTime.trim() || undefined,
        }),
      })
      if (res.ok) setSubmitted(true)
      else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Er ging iets mis. Probeer het later opnieuw.')
      }
    } catch {
      setError('Verbindingsfout. Probeer het later opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8 text-center">
          <p className="text-5xl mb-4">📞</p>
          <h1 className="text-2xl font-bold text-gravida-green mb-3">Aanvraag ontvangen!</h1>
          <p className="text-gravida-sage mb-6">
            We nemen binnen 1 werkdag contact met je op om een support call in te plannen.
            Tot snel!
          </p>
          <p className="text-sm text-gravida-light-sage">— Team Gravida</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8">
        <h1 className="text-2xl font-bold text-gravida-green mb-2">📞 Vraag een support call aan</h1>
        <p className="text-sm text-gravida-sage mb-6">
          We bellen je graag terug om mee te kijken bij het scannen.
          Vul hieronder eventueel een voorkeurstijdstip in en eventuele vragen die je alvast hebt.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Voorkeurstijdstip (optioneel)</label>
            <input className="input-field" placeholder="Bijv. morgen tussen 10:00 en 12:00"
              value={preferredTime} onChange={e => setPreferredTime(e.target.value)} />
          </div>
          <div>
            <label className="label">Vraag of context (optioneel)</label>
            <textarea className="input-field" rows={4}
              placeholder="Beschrijf kort waar je tegenaan loopt of wat je graag wilt weten."
              value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Verzenden...' : 'Aanvragen'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gravida-light-sage">Laden...</div>}>
      <Content />
    </Suspense>
  )
}
