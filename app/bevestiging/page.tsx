'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { formatDutchDate } from '@/lib/utils'

function BevestigingContent() {
  const params = useSearchParams()
  const nummer = params.get('nummer') ?? '????'
  const naam = params.get('naam') ?? ''
  const datum = params.get('datum') ?? ''
  const slot = params.get('slot') ?? ''
  const regio = params.get('regio') ?? ''

  return (
    <div className="min-h-screen bg-gravida-off-white flex flex-col">
      {/* Header */}
      <header className="bg-gravida-green text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Gravida</h1>
          <p className="text-gravida-light-sage text-sm mt-0.5">Zwangerschapsscans aan huis</p>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-12">
        {/* Success icon */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gravida-sage rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-semibold text-gravida-green mb-2">
            Boeking bevestigd!
          </h2>
          {naam && (
            <p className="text-gravida-sage text-lg">
              Bedankt, {naam}. We kijken ernaar uit u te ontmoeten.
            </p>
          )}
        </div>

        {/* Customer number — very prominent */}
        <div className="bg-gravida-green text-white rounded-3xl p-8 text-center mb-6 shadow-xl">
          <p className="text-gravida-light-sage text-sm font-medium uppercase tracking-widest mb-3">
            Uw klantnummer
          </p>
          <div className="text-8xl font-bold tracking-widest text-white mb-3 tabular-nums">
            {nummer}
          </div>
          <p className="text-gravida-light-sage text-sm">
            Bewaar dit nummer — u heeft het nodig bij contact met ons.
          </p>
        </div>

        {/* Booking details */}
        <div className="card mb-6">
          <h3 className="section-title mb-4">Boekingsdetails</h3>
          <dl className="space-y-3">
            {datum && (
              <div className="flex justify-between py-2 border-b border-gravida-cream last:border-0">
                <dt className="text-gravida-light-sage text-sm">Datum</dt>
                <dd className="font-medium text-sm text-right">{formatDutchDate(datum)}</dd>
              </div>
            )}
            {slot && (
              <div className="flex justify-between py-2 border-b border-gravida-cream last:border-0">
                <dt className="text-gravida-light-sage text-sm">Tijdslot</dt>
                <dd className="font-medium text-sm">{slot}</dd>
              </div>
            )}
            {regio && (
              <div className="flex justify-between py-2 border-b border-gravida-cream last:border-0">
                <dt className="text-gravida-light-sage text-sm">Regio</dt>
                <dd className="font-medium text-sm">{regio}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Info box */}
        <div className="bg-gravida-cream rounded-2xl p-5 mb-8 text-sm text-gravida-sage space-y-2">
          <p className="font-medium text-gravida-green">Wat nu?</p>
          <ul className="space-y-1.5 list-inside">
            <li className="flex gap-2">
              <span className="text-gravida-sage">•</span>
              U ontvangt een bevestigingsmail op het door u opgegeven e-mailadres.
            </li>
            <li className="flex gap-2">
              <span className="text-gravida-sage">•</span>
              Wij komen op het afgesproken tijdstip naar uw adres.
            </li>
            <li className="flex gap-2">
              <span className="text-gravida-sage">•</span>
              Bij vragen kunt u contact opnemen met uw klantnummer bij de hand.
            </li>
          </ul>
        </div>

        <div className="text-center">
          <Link href="/" className="btn-secondary inline-block">
            Terug naar de homepage
          </Link>
        </div>
      </main>

      <footer className="py-8 border-t border-gravida-cream text-center text-sm text-gravida-light-sage">
        © {new Date().getFullYear()} Gravida – Zwangerschapsscans aan huis
      </footer>
    </div>
  )
}

export default function BevestigingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gravida-off-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gravida-sage border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BevestigingContent />
    </Suspense>
  )
}
