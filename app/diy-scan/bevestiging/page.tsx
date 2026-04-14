'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function formatWeekLong(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00')
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${fmt(thu)} t/m ${fmt(sun)}`
}

export default function BevestigingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#fbf9f5' }}>Laden...</div>}>
      <BevestigingContent />
    </Suspense>
  )
}

function BevestigingContent() {
  const searchParams = useSearchParams()
  const rentalId = searchParams.get('rental_id')
  const [status, setStatus] = useState<'loading' | 'betaald' | 'verwerken' | 'mislukt'>('loading')
  const [rentalWeek, setRentalWeek] = useState('')

  useEffect(() => {
    if (!rentalId) { setStatus('mislukt'); return }

    let attempts = 0
    const maxAttempts = 20 // 20 * 2s = 40 seconds max

    const poll = async () => {
      try {
        const res = await fetch(`/api/diy-rentals/${rentalId}`)
        if (!res.ok) { setStatus('mislukt'); return }
        const data = await res.json()
        setRentalWeek(data.rental_week || '')

        if (data.payment_status === 'betaald') {
          setStatus('betaald')
          return
        }
        if (data.payment_status === 'mislukt' || data.status === 'geannuleerd') {
          setStatus('mislukt')
          return
        }

        attempts++
        if (attempts >= maxAttempts) {
          setStatus('verwerken')
          return
        }
        setTimeout(poll, 2000)
      } catch {
        setStatus('mislukt')
      }
    }
    poll()
  }, [rentalId])

  return (
    <>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Manrope:wght@300;400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>

      <div className="min-h-screen" style={{ background: '#fbf9f5', fontFamily: 'Manrope, sans-serif', color: '#1b1c1a' }}>
        <nav style={{ background: 'rgba(251,249,245,0.8)', backdropFilter: 'blur(20px)' }} className="fixed top-0 w-full z-50">
          <div className="flex justify-between items-center px-8 py-6 max-w-[1440px] mx-auto">
            <a href="https://www.gravida.nl" className="text-2xl italic" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Gravida</a>
            <a href="https://www.gravida.nl" className="text-sm hover:opacity-70 transition-opacity" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>
              Terug naar gravida.nl
            </a>
          </div>
        </nav>

        <main className="pt-24">
          <section className="py-32 px-8 md:px-20">
            <div className="max-w-2xl mx-auto text-center">
              <div className="p-14 md:p-20 rounded-[2rem]" style={{ background: '#fff', border: '1px solid rgba(195,200,191,0.3)' }}>

                {status === 'loading' && (
                  <>
                    <div className="w-16 h-16 rounded-full mx-auto mb-8 flex items-center justify-center animate-pulse" style={{ background: '#dbe6d7' }}>
                      <span className="material-symbols-outlined text-2xl" style={{ color: '#253c27' }}>hourglass_top</span>
                    </div>
                    <h2 className="text-2xl mb-4" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Betaling wordt verwerkt...</h2>
                    <p className="text-sm" style={{ color: '#737971' }}>Even geduld, we controleren je betaling.</p>
                  </>
                )}

                {status === 'betaald' && (
                  <>
                    <div className="w-20 h-20 rounded-full mx-auto mb-8 flex items-center justify-center" style={{ background: '#dbe6d7' }}>
                      <span className="material-symbols-outlined text-3xl" style={{ color: '#253c27', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl mb-4" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Reservering bevestigd</h2>
                    <p className="text-lg mb-2 leading-relaxed" style={{ color: '#434842' }}>
                      Je DIY 3D scan kit is gereserveerd voor
                    </p>
                    {rentalWeek && (
                      <p className="text-xl font-semibold mb-8" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>{formatWeekLong(rentalWeek)}</p>
                    )}
                    <p className="text-sm mb-4" style={{ color: '#737971' }}>
                      Je ontvangt een bevestiging per e-mail met alle details over de verzending en het retourproces.
                    </p>
                    <p className="text-sm mb-12" style={{ color: '#737971' }}>
                      De borg van &euro;200 is ontvangen en wordt teruggestort zodra de scanner in goede staat retour is. De borg kan ook verrekend worden met de bestelling van een beeldje.
                    </p>
                    <a href="https://www.gravida.nl" className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-medium text-sm transition-all hover:opacity-90" style={{ background: '#253c27', color: '#fff' }}>
                      Terug naar gravida.nl
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                  </>
                )}

                {status === 'verwerken' && (
                  <>
                    <div className="w-16 h-16 rounded-full mx-auto mb-8 flex items-center justify-center" style={{ background: '#dbe6d7' }}>
                      <span className="material-symbols-outlined text-2xl" style={{ color: '#253c27' }}>schedule</span>
                    </div>
                    <h2 className="text-2xl mb-4" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Betaling wordt nog verwerkt</h2>
                    <p className="text-sm mb-8" style={{ color: '#737971' }}>
                      Je betaling wordt nog verwerkt door de bank. Je ontvangt een bevestiging per e-mail zodra de betaling is geslaagd.
                    </p>
                    <a href="https://www.gravida.nl" className="text-sm hover:opacity-70 transition-opacity" style={{ color: '#253c27' }}>
                      Terug naar gravida.nl
                    </a>
                  </>
                )}

                {status === 'mislukt' && (
                  <>
                    <div className="w-16 h-16 rounded-full mx-auto mb-8 flex items-center justify-center" style={{ background: '#ffdad6' }}>
                      <span className="material-symbols-outlined text-2xl" style={{ color: '#ba1a1a' }}>error</span>
                    </div>
                    <h2 className="text-2xl mb-4" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Betaling niet gelukt</h2>
                    <p className="text-sm mb-8" style={{ color: '#737971' }}>
                      De betaling is niet geslaagd of geannuleerd. Je kunt het opnieuw proberen.
                    </p>
                    <a href="/diy-scan" className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-medium text-sm transition-all hover:opacity-90" style={{ background: '#253c27', color: '#fff' }}>
                      Opnieuw proberen
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                  </>
                )}

              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
