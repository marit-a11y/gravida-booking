'use client'

import { useEffect, useState } from 'react'

function formatWeek(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00')
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${fmt(thu)} t/m ${fmt(sun)}`
}

const BRAND = { green: '#3d5c41', cream: '#f5f4f0', offWhite: '#faf9f7', sage: '#6b8c6e' }

export default function DiyScanPage() {
  const [weeks, setWeeks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState('')
  const [step, setStep] = useState<'select' | 'form' | 'success'>('select')
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address: '', city: '', zip_code: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/diy-rentals')
      .then(r => r.ok ? r.json() : { weeks: [] })
      .then(d => setWeeks(d.weeks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async () => {
    const required = ['first_name', 'last_name', 'email', 'phone', 'address', 'city', 'zip_code'] as const
    for (const f of required) {
      if (!form[f].trim()) { setError('Vul alle verplichte velden in.'); return }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Vul een geldig e-mailadres in.'); return }

    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/diy-rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, rental_week: selectedWeek }),
      })
      if (res.ok) {
        setStep('success')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Er ging iets mis. Probeer het opnieuw.')
      }
    } catch { setError('Verbindingsfout.') }
    finally { setSubmitting(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: BRAND.offWhite, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ background: BRAND.green, padding: '28px 24px', textAlign: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: -0.5 }}>Gravida</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, margin: '4px 0 0' }}>DIY 3D Scan Kit Reserveren</p>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px' }}>
        {/* Info blok */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', marginBottom: 24, border: '1px solid #e8e6e0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1e2d1f', margin: '0 0 12px' }}>Hoe werkt het?</h2>
          <div style={{ fontSize: 14, color: '#3d4d3e', lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 8px' }}>Leen gratis onze 3D scanner en maak thuis op je eigen tempo prachtige scans van je buik.</p>
            <p style={{ margin: '0 0 8px' }}><strong>Tijdlijn:</strong></p>
            <ul style={{ margin: '0 0 8px', paddingLeft: 20 }}>
              <li>Wij verzenden de scanner op <strong>woensdag</strong></li>
              <li>Jij ontvangt hem op <strong>donderdag</strong></li>
              <li>Scannen van <strong>donderdag t/m zondag</strong></li>
              <li>Retour sturen op <strong>maandag</strong></li>
            </ul>
            <p style={{ margin: '0', background: BRAND.cream, padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>
              Er geldt een borg van <strong>&euro;200</strong>. Deze wordt volledig teruggestort zodra de scanner in goede staat retour is.
            </p>
          </div>
        </div>

        {step === 'select' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', border: '1px solid #e8e6e0' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e2d1f', margin: '0 0 16px' }}>Kies je week</h2>
            {loading ? (
              <p style={{ textAlign: 'center', color: BRAND.sage, padding: '32px 0' }}>Beschikbaarheid laden...</p>
            ) : weeks.length === 0 ? (
              <p style={{ textAlign: 'center', color: BRAND.sage, padding: '32px 0' }}>Momenteel geen scanners beschikbaar. Probeer het later opnieuw.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {weeks.map(w => (
                  <button key={w} onClick={() => { setSelectedWeek(w); setStep('form') }}
                    style={{
                      background: BRAND.cream, border: '2px solid transparent', borderRadius: 12,
                      padding: '14px 18px', textAlign: 'left', cursor: 'pointer', fontSize: 15,
                      color: '#1e2d1f', fontWeight: 500, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = BRAND.green }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = 'transparent' }}
                  >
                    {formatWeek(w)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'form' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', border: '1px solid #e8e6e0' }}>
            <button onClick={() => setStep('select')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: BRAND.sage, marginBottom: 12, padding: 0 }}>
              &larr; Andere week kiezen
            </button>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e2d1f', margin: '0 0 4px' }}>Jouw gegevens</h2>
            <p style={{ fontSize: 13, color: BRAND.sage, margin: '0 0 20px' }}>Week: {formatWeek(selectedWeek)}</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Voornaam *" value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} />
              <Input label="Achternaam *" value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} />
              <Input label="E-mail *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
              <Input label="Telefoon *" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Adres *" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
              </div>
              <Input label="Postcode *" value={form.zip_code} onChange={v => setForm(f => ({ ...f, zip_code: v }))} />
              <Input label="Stad *" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Opmerkingen</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0ddd7', fontSize: 15, resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</p>}

            <button onClick={handleSubmit} disabled={submitting}
              style={{
                width: '100%', marginTop: 20, padding: '14px', background: BRAND.green, color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}>
              {submitting ? 'Bezig met reserveren...' : 'Reserveren'}
            </button>
          </div>
        )}

        {step === 'success' && (
          <div style={{ background: '#fff', borderRadius: 16, padding: '40px 24px', border: '1px solid #e8e6e0', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1e2d1f', margin: '0 0 12px' }}>Reservering bevestigd!</h2>
            <p style={{ fontSize: 15, color: '#3d4d3e', lineHeight: 1.7, margin: '0 0 8px' }}>
              Je DIY 3D scan kit is gereserveerd voor <strong>{formatWeek(selectedWeek)}</strong>.
            </p>
            <p style={{ fontSize: 14, color: BRAND.sage, margin: '0 0 24px' }}>
              Je ontvangt een bevestiging per e-mail met alle details.
            </p>
            <a href="/" style={{ color: BRAND.green, fontSize: 14, fontWeight: 500 }}>Terug naar de homepage</a>
          </div>
        )}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0ddd7', fontSize: 15, boxSizing: 'border-box' }} />
    </div>
  )
}
