'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

/* eslint-disable @next/next/no-page-custom-font */

type GiftCardType = 'digitaal' | 'gedrukt' | 'usb_box'
type Step = 'type' | 'bedrag' | 'details' | 'overzicht'

interface FormData {
  type: GiftCardType | null
  value_euros: number | null
  van_naam: string
  van_email: string
  voor_naam: string
  voor_email: string
  bericht: string
}

const TYPES: { key: GiftCardType; label: string; description: string; icon: string }[] = [
  {
    key: 'digitaal',
    label: 'Digitale cadeaubon',
    description: 'Direct per e-mail ontvangen. De ontvanger kiest zelf welk zwangerschapsbeeldje of sieraad ze wil laten maken.',
    icon: '📧',
  },
  {
    key: 'gedrukt',
    label: 'Gedrukte cadeaubon',
    description: 'Een elegante cadeaubon op papier in een mooie envelop. Ideaal als je iets tastbaars wil overhandigen.',
    icon: '✉️',
  },
  {
    key: 'usb_box',
    label: 'USB Cadeaubox',
    description: 'Een prachtig houten doosje met USB-stick in hartvorm en sleutelhanger, voorzien van het Gravida logo.',
    icon: '🎁',
  },
]

const VALID_TYPES: GiftCardType[] = ['digitaal', 'gedrukt', 'usb_box']
const PRESET_AMOUNTS = [25, 50, 75, 100, 150, 200]

const STEP_LABELS: Record<Step, string> = {
  type: 'Type',
  bedrag: 'Bedrag',
  details: 'Gegevens',
  overzicht: 'Overzicht',
}

const STEPS: Step[] = ['type', 'bedrag', 'details', 'overzicht']

function CadeaubonInner() {
  const searchParams = useSearchParams()
  const urlType = searchParams.get('type') as GiftCardType | null
  const embed = searchParams.get('embed') === '1'

  const preselectedType = urlType && VALID_TYPES.includes(urlType) ? urlType : null

  const [step, setStep] = useState<Step>(preselectedType ? 'bedrag' : 'type')
  const [form, setForm] = useState<FormData>({
    type: preselectedType,
    value_euros: null,
    van_naam: '',
    van_email: '',
    voor_naam: '',
    voor_email: '',
    bericht: '',
  })
  const [customAmount, setCustomAmount] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // If URL type changes (e.g. navigating), re-sync
  useEffect(() => {
    if (preselectedType && form.type !== preselectedType) {
      setForm(f => ({ ...f, type: preselectedType }))
      setStep('bedrag')
    }
  }, [preselectedType]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedType = TYPES.find(t => t.key === form.type)
  const currentStepIndex = STEPS.indexOf(step)

  const goBack = () => {
    if (currentStepIndex > 0) {
      // If type was pre-selected via URL, don't go back past 'bedrag'
      const minStep = preselectedType ? 1 : 0
      if (currentStepIndex > minStep) setStep(STEPS[currentStepIndex - 1])
    }
  }

  const handleTypeSelect = (type: GiftCardType) => {
    setForm(f => ({ ...f, type }))
    setStep('bedrag')
  }

  const handleAmountNext = () => {
    const value = form.value_euros ?? (customAmount ? parseFloat(customAmount) : null)
    if (!value || isNaN(value) || value < 25 || value > 500) {
      setError('Kies een bedrag tussen €25 en €500.')
      return
    }
    setForm(f => ({ ...f, value_euros: value }))
    setError('')
    setStep('details')
  }

  const handleDetailsNext = () => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!form.van_naam.trim() || !form.van_email.trim() || !form.voor_naam.trim() || !form.voor_email.trim()) {
      setError('Vul alle verplichte velden in.')
      return
    }
    if (!emailRe.test(form.van_email)) {
      setError('Vul een geldig e-mailadres in voor de koper.')
      return
    }
    if (!emailRe.test(form.voor_email)) {
      setError('Vul een geldig e-mailadres in voor de ontvanger.')
      return
    }
    setError('')
    setStep('overzicht')
  }

  const handleSubmit = async () => {
    if (!form.type || !form.value_euros) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/gift-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          value_euros: form.value_euros,
          purchaser_name: form.van_naam.trim(),
          purchaser_email: form.van_email.trim().toLowerCase(),
          recipient_name: form.voor_naam.trim(),
          recipient_email: form.voor_email.trim().toLowerCase(),
          personal_message: form.bericht.trim() || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
        } else {
          setError('Geen checkout-URL ontvangen. Probeer het opnieuw.')
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Er is iets misgegaan. Probeer het opnieuw.')
      }
    } catch {
      setError('Verbindingsfout. Controleer je internetverbinding.')
    } finally {
      setSubmitting(false)
    }
  }

  // In embed mode: tighter padding, no outer header/footer
  const outerPadding = embed ? '16px 12px' : '32px 16px'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');
        body { font-family: 'Inter Tight', system-ui, -apple-system, sans-serif; background: #f5f4f0; }
        @media (max-width: 400px) { .step-label { display: none !important; } }
      `}</style>

      <div style={{ minHeight: embed ? 'unset' : '100vh', background: '#f5f4f0', padding: outerPadding }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>

          {/* Header — hidden in embed mode */}
          {!embed && (
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <a href="https://www.gravida.nl" style={{ textDecoration: 'none' }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#3d5c41', letterSpacing: '-0.5px' }}>Gravida</span>
              </a>
              <h1 style={{ margin: '12px 0 6px', fontSize: 28, fontWeight: 700, color: '#1e2d1f', letterSpacing: '-0.5px' }}>
                Cadeaubon bestellen
              </h1>
              <p style={{ margin: 0, color: '#6b7e6d', fontSize: 15 }}>
                Geef een zwangerschapsscan of herinneringssieraad cadeau
              </p>
            </div>
          )}

          {/* Progress indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: embed ? 20 : 32 }}>
            {STEPS.map((s, i) => {
              // Hide 'type' step in progress bar when pre-selected via URL
              if (preselectedType && s === 'type') return null
              const adjustedIndex = preselectedType ? i - 1 : i
              const adjustedCurrentIndex = preselectedType ? currentStepIndex - 1 : currentStepIndex
              const isLast = preselectedType ? i === STEPS.length - 1 : i === STEPS.length - 1
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: adjustedIndex <= adjustedCurrentIndex ? '#3d5c41' : '#e8e6e0',
                    color: adjustedIndex <= adjustedCurrentIndex ? '#fff' : '#9aab9c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                  }}>
                    {adjustedIndex < adjustedCurrentIndex ? '✓' : adjustedIndex + 1}
                  </div>
                  <span className="step-label" style={{
                    fontSize: 12, marginLeft: 4,
                    color: i === currentStepIndex ? '#3d5c41' : '#9aab9c',
                    fontWeight: i === currentStepIndex ? 600 : 400,
                  }}>
                    {STEP_LABELS[s]}
                  </span>
                  {!isLast && (
                    <div style={{ width: 24, height: 2, background: adjustedIndex < adjustedCurrentIndex ? '#3d5c41' : '#e8e6e0', margin: '0 6px', transition: 'all 0.2s' }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Card container */}
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 16px rgba(61,92,65,0.08)', overflow: 'hidden' }}>

            {/* Step: type */}
            {step === 'type' && (
              <div style={{ padding: 28 }}>
                <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: '#1e2d1f' }}>
                  Kies het type cadeaubon
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {TYPES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => handleTypeSelect(t.key)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px',
                        borderRadius: 14, border: '1.5px solid #e8e6e0', background: '#fff',
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.borderColor = '#3d5c41')}
                      onMouseOut={e => (e.currentTarget.style.borderColor = '#e8e6e0')}
                    >
                      <span style={{ fontSize: 26, lineHeight: 1.2 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e2d1f', marginBottom: 4 }}>{t.label}</div>
                        <div style={{ fontSize: 13, color: '#6b7e6d', lineHeight: 1.5 }}>{t.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step: bedrag */}
            {step === 'bedrag' && (
              <div style={{ padding: 28 }}>
                {!preselectedType && (
                  <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#3d5c41', cursor: 'pointer', fontSize: 13, padding: '0 0 16px', fontFamily: 'inherit' }}>
                    &#8592; Terug
                  </button>
                )}
                <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, color: '#1e2d1f' }}>
                  Kies het bedrag
                </h2>
                {selectedType && (
                  <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7e6d' }}>
                    {selectedType.icon} {selectedType.label}
                  </p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                  {PRESET_AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => { setForm(f => ({ ...f, value_euros: amount })); setCustomAmount('') }}
                      style={{
                        padding: '12px 8px', borderRadius: 12, border: '1.5px solid',
                        borderColor: form.value_euros === amount ? '#3d5c41' : '#e8e6e0',
                        background: form.value_euros === amount ? '#3d5c41' : '#fff',
                        color: form.value_euros === amount ? '#fff' : '#1e2d1f',
                        fontWeight: 600, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s',
                        fontFamily: 'inherit',
                      }}
                    >
                      &euro;{amount}
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9aab9c', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                    Of voer een eigen bedrag in (&euro;25 – &euro;500)
                  </label>
                  <input
                    type="number"
                    min={25}
                    max={500}
                    value={customAmount}
                    onChange={e => { setCustomAmount(e.target.value); setForm(f => ({ ...f, value_euros: null })) }}
                    placeholder="Eigen bedrag..."
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1.5px solid #e8e6e0', fontSize: 15, color: '#1e2d1f',
                      outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                </div>
                {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
                <button
                  onClick={handleAmountNext}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 12, background: '#3d5c41',
                    color: '#fff', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Verder
                </button>
              </div>
            )}

            {/* Step: details */}
            {step === 'details' && (
              <div style={{ padding: 28 }}>
                <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#3d5c41', cursor: 'pointer', fontSize: 13, padding: '0 0 16px', fontFamily: 'inherit' }}>
                  &#8592; Terug
                </button>
                <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: '#1e2d1f' }}>
                  Vul de gegevens in
                </h2>

                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#9aab9c', textTransform: 'uppercase', letterSpacing: 1 }}>Van (koper)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Jouw naam *</FieldLabel>
                      <FieldInput value={form.van_naam} onChange={v => setForm(f => ({ ...f, van_naam: v }))} placeholder="bv. Lisa de Vries" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Jouw e-mailadres *</FieldLabel>
                      <FieldInput type="email" value={form.van_email} onChange={v => setForm(f => ({ ...f, van_email: v }))} placeholder="bv. lisa@email.nl" />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#9aab9c', textTransform: 'uppercase', letterSpacing: 1 }}>Voor (ontvanger)</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>Naam van de ontvanger *</FieldLabel>
                      <FieldInput value={form.voor_naam} onChange={v => setForm(f => ({ ...f, voor_naam: v }))} placeholder="bv. Emma Jansen" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <FieldLabel>E-mailadres van de ontvanger *</FieldLabel>
                      <FieldInput type="email" value={form.voor_email} onChange={v => setForm(f => ({ ...f, voor_email: v }))} placeholder="bv. emma@email.nl" />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <FieldLabel>Persoonlijk bericht (optioneel, max. 300 tekens)</FieldLabel>
                  <textarea
                    value={form.bericht}
                    onChange={e => setForm(f => ({ ...f, bericht: e.target.value }))}
                    maxLength={300}
                    rows={3}
                    placeholder="bv. Gefeliciteerd! Ik hoop dat je hier veel plezier van hebt."
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1.5px solid #e8e6e0', fontSize: 14, color: '#1e2d1f',
                      outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9aab9c', textAlign: 'right' }}>{form.bericht.length}/300</p>
                </div>

                {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
                <button
                  onClick={handleDetailsNext}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 12, background: '#3d5c41',
                    color: '#fff', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Verder
                </button>
              </div>
            )}

            {/* Step: overzicht */}
            {step === 'overzicht' && (
              <div style={{ padding: 28 }}>
                <button onClick={goBack} style={{ background: 'none', border: 'none', color: '#3d5c41', cursor: 'pointer', fontSize: 13, padding: '0 0 16px', fontFamily: 'inherit' }}>
                  &#8592; Terug
                </button>
                <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: '#1e2d1f' }}>
                  Overzicht
                </h2>

                <div style={{ background: '#f5f4f0', borderRadius: 14, padding: 20, marginBottom: 20 }}>
                  <SummaryRow label="Type" value={selectedType?.label ?? ''} />
                  <SummaryRow label="Bedrag" value={`\u20AC${form.value_euros}`} bold />
                  <SummaryRow label="Van" value={`${form.van_naam} (${form.van_email})`} />
                  <SummaryRow label="Voor" value={`${form.voor_naam} (${form.voor_email})`} />
                  {form.bericht && (
                    <div style={{ paddingTop: 10, marginTop: 10, borderTop: '1px solid #e8e6e0' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#9aab9c', fontWeight: 600 }}>Persoonlijk bericht</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#3d4d3e', fontStyle: 'italic', lineHeight: 1.5 }}>{form.bericht}</p>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: 13, color: '#6b7e6d', marginBottom: 20, lineHeight: 1.6 }}>
                  Na betaling ontvangen zowel jij als de ontvanger een e-mail met de cadeauboncode.
                </p>

                {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, background: submitting ? '#8aab8e' : '#3d5c41',
                    color: '#fff', fontWeight: 600, fontSize: 16, border: 'none',
                    cursor: submitting ? 'default' : 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
                  }}
                >
                  {submitting ? 'Bezig met doorsturen...' : `Betalen \u2014 \u20AC${form.value_euros}`}
                </button>
              </div>
            )}
          </div>

          {/* Footer — hidden in embed mode */}
          {!embed && (
            <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#9aab9c' }}>
              &copy; {new Date().getFullYear()} Gravida &middot; <a href="https://www.gravida.nl" style={{ color: '#9aab9c' }}>www.gravida.nl</a>
            </p>
          )}
        </div>
      </div>
    </>
  )
}

export default function CadeaubonPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#f5f4f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7e6d', fontFamily: 'system-ui, sans-serif' }}>Laden…</p>
      </div>
    }>
      <CadeaubonInner />
    </Suspense>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9aab9c', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 5 }}>
      {children}
    </label>
  )
}

function FieldInput({
  value, onChange, type = 'text', placeholder,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', padding: '10px 14px', borderRadius: 10,
        border: '1.5px solid #e8e6e0', fontSize: 14, color: '#1e2d1f',
        outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit',
      }}
    />
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e8e6e0' }}>
      <span style={{ fontSize: 13, color: '#9aab9c' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 700 : 500, color: '#1e2d1f', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}
