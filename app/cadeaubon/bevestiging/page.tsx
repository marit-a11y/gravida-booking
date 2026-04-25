'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

/* eslint-disable @next/next/no-page-custom-font */

function BevestigingContent() {
  const searchParams = useSearchParams()
  const giftCardId = searchParams.get('gift_card_id')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        body { font-family: 'Inter Tight', system-ui, -apple-system, sans-serif; background: #f5f4f0; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
        <div style={{ maxWidth: 480, width: '100%' }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <a href="https://www.gravida.nl" style={{ textDecoration: 'none' }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#3d5c41', letterSpacing: '-0.5px' }}>Gravida</span>
            </a>
          </div>

          {/* Card */}
          <div style={{
            background: '#fff', borderRadius: 20,
            boxShadow: '0 2px 16px rgba(61,92,65,0.08)', padding: 40,
            textAlign: 'center',
          }}>
            {/* Success icon */}
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#e8f0e9', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <span style={{ fontSize: 28 }}>🎁</span>
            </div>

            <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: '#1e2d1f', letterSpacing: '-0.5px' }}>
              Bedankt!
            </h1>

            <p style={{ margin: '0 0 16px', fontSize: 15, color: '#3d4d3e', lineHeight: 1.75 }}>
              Je bestelling is ontvangen. Je ontvangt binnen enkele minuten een bevestiging per e-mail.
            </p>

            <p style={{ margin: '0 0 28px', fontSize: 15, color: '#3d4d3e', lineHeight: 1.75 }}>
              De ontvanger krijgt ook een e-mail met de cadeauboncode zodra de betaling is verwerkt.
            </p>

            {/* Divider */}
            <div style={{ height: 1, background: '#e8e6e0', margin: '0 0 24px' }} />

            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9aab9c', lineHeight: 1.6 }}>
              Heb je vragen? Neem gerust contact op via{' '}
              <a href="mailto:info@gravida.nl" style={{ color: '#3d5c41' }}>info@gravida.nl</a>.
            </p>

            <a
              href="https://www.gravida.nl"
              style={{
                display: 'inline-block', background: '#3d5c41', color: '#fff',
                textDecoration: 'none', padding: '12px 28px', borderRadius: 10,
                fontSize: 14, fontWeight: 600,
              }}
            >
              Terug naar Gravida.nl
            </a>
          </div>

          {giftCardId && (
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#c0ccc1' }}>
              Bestelnummer: GC-{giftCardId}
            </p>
          )}

          <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#9aab9c' }}>
            &copy; {new Date().getFullYear()} Gravida &middot; <a href="https://www.gravida.nl" style={{ color: '#9aab9c' }}>www.gravida.nl</a>
          </p>
        </div>
      </div>
    </>
  )
}

export default function CadeaubonBevestigingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 15, color: '#6b7e6d' }}>Laden...</div>
      </div>
    }>
      <BevestigingContent />
    </Suspense>
  )
}
