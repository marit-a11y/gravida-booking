'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

function Content() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params?.token as string
  const initialResponse = searchParams.get('response') as 'ok' | 'question' | null

  const [firstName, setFirstName] = useState('')
  const [stage, setStage] = useState<'loading' | 'ok' | 'question' | 'done' | 'already'>('loading')
  const [question, setQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/diy-check-in/${token}`).then(r => r.json()).then(data => {
      if (data?.rental?.first_name) setFirstName(data.rental.first_name)
      if (data?.rental?.check_in_response) {
        setStage('already')
        return
      }
      if (initialResponse === 'ok') {
        // Direct OK doorgeven
        submitOk()
      } else if (initialResponse === 'question') {
        setStage('question')
      } else {
        setStage('ok')  // toon beide opties
      }
    }).catch(() => setStage('ok'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, initialResponse])

  const submitOk = async () => {
    setSubmitting(true)
    try {
      await fetch(`/api/diy-check-in/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'ok' }),
      })
      setStage('done')
    } finally { setSubmitting(false) }
  }

  const submitQuestion = async () => {
    setSubmitting(true)
    try {
      await fetch(`/api/diy-check-in/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'question', question: question.trim() || null }),
      })
      setStage('done')
    } finally { setSubmitting(false) }
  }

  if (stage === 'loading') {
    return <div className="p-12 text-center text-sm text-gravida-light-sage">Even laden...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gravida-cream p-8">
        {stage === 'done' && (
          <div className="text-center">
            <p className="text-5xl mb-4">✨</p>
            <h1 className="text-2xl font-bold text-gravida-green mb-3">Dankjewel!</h1>
            <p className="text-gravida-sage">We hebben je reactie ontvangen.</p>
            <p className="text-sm text-gravida-light-sage mt-3">Laila, Gravida</p>
          </div>
        )}

        {stage === 'already' && (
          <div className="text-center">
            <p className="text-5xl mb-4">✓</p>
            <h1 className="text-2xl font-bold text-gravida-green mb-3">Al doorgegeven</h1>
            <p className="text-gravida-sage">We hebben je eerdere reactie al ontvangen. Tot snel!</p>
          </div>
        )}

        {stage === 'ok' && (
          <>
            <h1 className="text-2xl font-bold text-gravida-green mb-2">Hoe gaat het, {firstName}?</h1>
            <p className="text-sm text-gravida-sage mb-6">
              Laat even weten of alles goed loopt met de scanner of dat je nog een vraag hebt.
            </p>
            <div className="space-y-3">
              <button onClick={submitOk} disabled={submitting}
                className="w-full py-3 rounded-xl bg-gravida-green text-white font-medium hover:bg-gravida-sage transition-colors disabled:opacity-50">
                Alles werkt prima!
              </button>
              <button onClick={() => setStage('question')} disabled={submitting}
                className="w-full py-3 rounded-xl bg-white border-2 border-gravida-green text-gravida-green font-medium hover:bg-gravida-cream transition-colors disabled:opacity-50">
                Ik heb een vraag
              </button>
            </div>
          </>
        )}

        {stage === 'question' && (
          <>
            <h1 className="text-2xl font-bold text-gravida-green mb-2">Wat is je vraag?</h1>
            <p className="text-sm text-gravida-sage mb-4">
              Beschrijf kort wat er aan de hand is. Laila neemt zo snel mogelijk contact met je op.
            </p>
            <textarea rows={5}
              className="w-full text-sm px-3 py-2 border border-gravida-cream rounded-lg focus:outline-none focus:border-gravida-sage mb-3"
              placeholder="Bijv. de scanner doet vreemd, of ik weet niet zeker of de scan goed is..."
              value={question} onChange={e => setQuestion(e.target.value)} />
            <button onClick={submitQuestion} disabled={submitting}
              className="w-full py-3 rounded-xl bg-gravida-green text-white font-medium hover:bg-gravida-sage transition-colors disabled:opacity-50">
              {submitting ? 'Verzenden...' : 'Versturen'}
            </button>
            <p className="text-xs text-gravida-light-sage text-center mt-3">
              Of app Laila direct via 06 8706 2504
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gravida-light-sage">Laden...</div>}>
      <Content />
    </Suspense>
  )
}
