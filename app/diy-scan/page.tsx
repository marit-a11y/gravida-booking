'use client'

import { useEffect, useState } from 'react'

/* eslint-disable @next/next/no-page-custom-font */

function formatWeekShort(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00')
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
  return `${fmt(thu)} – ${fmt(sun)}`
}

function formatWeekLong(mondayStr: string): string {
  const mon = new Date(mondayStr + 'T00:00:00')
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${fmt(thu)} t/m ${fmt(sun)}`
}

interface WeekStatus {
  monday: string
  status: 'available' | 'last_one' | 'sold_out'
}

export default function DiyScanPage() {
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWeek, setSelectedWeek] = useState('')
  const [step, setStep] = useState<'landing' | 'form'>('landing')
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    address: '', city: '', zip_code: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/diy-rentals')
      .then(r => r.ok ? r.json() : { weekStatuses: [] })
      .then(d => {
        if (Array.isArray(d.weekStatuses)) {
          setWeekStatuses(d.weekStatuses)
        } else if (Array.isArray(d.weeks)) {
          // Fallback for old API shape
          setWeekStatuses(d.weeks.map((monday: string) => ({ monday, status: 'available' as const })))
        }
      })
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
        const data = await res.json()
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
          return
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Er ging iets mis. Probeer het opnieuw.')
      }
    } catch { setError('Verbindingsfout.') }
    finally { setSubmitting(false) }
  }

  return (
    <>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400&family=Manrope:wght@300;400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>

      <div className="min-h-screen" style={{ background: '#fbf9f5', fontFamily: 'Manrope, sans-serif', color: '#1b1c1a' }}>
        {/* Nav */}
        <nav style={{ background: 'rgba(251,249,245,0.8)', backdropFilter: 'blur(20px)' }} className="fixed top-0 w-full z-50">
          <div className="flex justify-between items-center px-8 py-6 max-w-[1440px] mx-auto">
            <a href="https://www.gravida.nl" className="text-2xl italic" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Gravida</a>
            <a href="https://www.gravida.nl" className="text-sm hover:opacity-70 transition-opacity" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>
              Terug naar gravida.nl
            </a>
          </div>
        </nav>

        <main className="pt-24">
          {step === 'landing' && (
            <>
              {/* Hero */}
              <section className="relative min-h-[700px] flex items-center px-8 md:px-20 overflow-hidden">
                <div className="max-w-[1440px] mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
                  <div className="md:col-span-6 z-10">
                    <span className="uppercase tracking-widest text-xs mb-6 block" style={{ fontFamily: 'Manrope', color: 'rgba(37,60,39,0.6)' }}>DIY 3D Scan Kit</span>
                    <h1 className="text-5xl md:text-7xl mb-8" style={{ fontFamily: 'Noto Serif', color: '#253c27', lineHeight: 1.1 }}>
                      Scan je buik <em>thuis</em>, op jouw tempo.
                    </h1>
                    <p className="text-lg max-w-md mb-10 leading-relaxed" style={{ color: '#434842' }}>
                      Met onze DIY scan kit maak je zelf een 3D-scan van je zwangere buik. De kit wordt thuisbezorgd, de scan duurt slechts enkele minuten en wij verwerken alles professioneel.
                    </p>
                    <a href="#booking" className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-medium text-sm transition-all hover:opacity-90" style={{ background: '#253c27', color: '#fff' }}>
                      Reserveer je week
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </a>
                  </div>
                  <div className="md:col-span-6 relative h-[500px] md:h-[600px]">
                    <div className="absolute inset-0 rounded-[2rem] overflow-hidden" style={{ background: '#f0eeea' }}>
                      <img className="w-full h-full object-contain p-8" src="/diy-hero.jpg" alt="3D zwangerschapsbeeldje" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Hoe werkt het */}
              <section className="py-32 px-8 md:px-20" style={{ background: '#f5f3ef' }}>
                <div className="max-w-[1440px] mx-auto">
                  <div className="text-center mb-24">
                    <h2 className="text-4xl mb-4" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Hoe werkt het?</h2>
                    <div className="h-1 w-12 mx-auto" style={{ background: '#253c27' }}></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                      { icon: 'local_shipping', title: 'Woensdag', desc: 'Wij verzenden de scan kit naar jouw adres. Alles zit erin: scanner, handleiding en retourlabel.', filled: false },
                      { icon: 'inventory_2', title: 'Donderdag', desc: 'De kit komt aan. Pak rustig uit en lees de eenvoudige instructies. Geen technische kennis nodig.', filled: false },
                      { icon: '3d_rotation', title: 'Vrijdag t/m Zondag', desc: 'Maak de scan op je eigen tempo. De scan zelf duurt slechts enkele minuten. Wij raden zwangerschapsweek 32+ aan.', filled: true },
                      { icon: 'keyboard_return', title: 'Maandag', desc: 'Plak de retoursticker op de doos en geef het af bij een PostNL punt. Wij verwerken je scan professioneel.', filled: false },
                    ].map((s, i) => (
                      <div key={i} className="p-10 rounded-[2rem] flex flex-col items-start gap-8" style={{ background: '#fbf9f5', border: '1px solid rgba(195,200,191,0.1)' }}>
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: s.filled ? '#253c27' : '#dbe6d7' }}>
                          <span className="material-symbols-outlined" style={{ color: s.filled ? '#fff' : '#253c27', fontVariationSettings: s.filled ? "'FILL' 1" : "'FILL' 0" }}>{s.icon}</span>
                        </div>
                        <div>
                          <h3 className="text-xl mb-3" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>{s.title}</h3>
                          <p className="leading-relaxed text-sm" style={{ color: '#434842' }}>{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Borg callout */}
              <section className="py-20 px-8">
                <div className="max-w-4xl mx-auto p-12 md:p-20 rounded-[2.5rem] relative overflow-hidden text-center" style={{ background: '#253c27', color: '#fff' }}>
                  <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl mb-6" style={{ fontFamily: 'Noto Serif' }}>Transparante Borg</h2>
                    <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      Voor de hoogwaardige scanapparatuur vragen we een borg van <span className="font-bold text-white">&euro;200</span>. Deze wordt direct na ontvangst en controle van de set weer op je rekening teruggestort. De borg kan ook verrekend worden met de bestelling van een beeldje.
                    </p>
                    <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.2)' }}>
                      <span className="material-symbols-outlined text-sm">verified_user</span>
                      <span className="text-xs uppercase tracking-widest">Veilig &amp; Vertrouwd</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute -top-1/2 -left-1/4 w-full h-full rounded-full bg-gradient-to-br from-white to-transparent blur-3xl"></div>
                  </div>
                </div>
              </section>

              {/* Na de scan */}
              <section className="py-20 px-8 md:px-20">
                <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: 'search', title: 'Professionele controle', desc: 'Na ontvangst controleren en verwerken wij je scan tot een hoogwaardig 3D-bestand.' },
                    { icon: 'preview', title: 'Voorvertoning ontvangen', desc: 'Je ontvangt een preview van je scan. Geen directe beslissing nodig over een beeldje.' },
                    { icon: 'savings', title: 'Scan bewaard', desc: 'Je scan wordt een jaar gratis opgeslagen. Bestel je beeldje wanneer het jou uitkomt.' },
                  ].map((item, i) => (
                    <div key={i} className="p-8 rounded-[2rem] flex items-start gap-5" style={{ background: '#fbf9f5', border: '1px solid rgba(195,200,191,0.2)' }}>
                      <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: '#dbe6d7' }}>
                        <span className="material-symbols-outlined text-sm" style={{ color: '#253c27' }}>{item.icon}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1" style={{ color: '#253c27' }}>{item.title}</h3>
                        <p className="text-sm leading-relaxed" style={{ color: '#434842' }}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Kies je week */}
              <section className="py-32 px-8 md:px-20" id="booking">
                <div className="max-w-[1440px] mx-auto">
                  <div className="max-w-xl mb-16">
                    <h2 className="text-4xl mb-6" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Kies je week</h2>
                    <p style={{ color: '#434842' }}>Selecteer de periode waarin jij je 3D-scan wilt maken. We raden aan om dit tussen week 30 en 36 van je zwangerschap te doen.</p>
                  </div>

                  {loading ? (
                    <p className="text-center py-20" style={{ color: '#737971' }}>Beschikbaarheid laden...</p>
                  ) : weekStatuses.length === 0 ? (
                    <p className="text-center py-20" style={{ color: '#737971' }}>Momenteel geen scanners beschikbaar. Probeer het later opnieuw.</p>
                  ) : (
                    <div className="flex gap-6 overflow-x-auto pb-10" style={{ scrollbarWidth: 'none' }}>
                      {weekStatuses.map(({ monday: w, status }) => {
                        const isSoldOut = status === 'sold_out'
                        const isLastOne = status === 'last_one'

                        // Sold out card: red, not clickable
                        if (isSoldOut) {
                          return (
                            <div key={w}
                              className="min-w-[300px] p-8 rounded-[2rem] text-left cursor-not-allowed select-none"
                              style={{ background: '#fff5f5', border: '1px solid #fecaca', opacity: 0.85 }}
                            >
                              <div className="flex justify-between items-start mb-12">
                                <span className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-bold"
                                  style={{ background: '#dc2626', color: '#fff' }}>
                                  Uitverkocht
                                </span>
                                <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>event_busy</span>
                              </div>
                              <h4 className="text-2xl mb-2" style={{ fontFamily: 'Noto Serif', color: '#7f1d1d', textDecoration: 'line-through' }}>{formatWeekShort(w)}</h4>
                              <p className="text-sm mb-8" style={{ color: '#991b1b' }}>Geen scanner meer beschikbaar</p>
                              <div className="h-[1px] w-full mb-8" style={{ background: '#fecaca' }}></div>
                              <div className="flex justify-between items-center">
                                <span className="text-xl" style={{ fontFamily: 'Noto Serif', color: '#7f1d1d', textDecoration: 'line-through' }}>Gratis</span>
                                <span className="text-xs uppercase tracking-widest font-bold" style={{ color: '#7f1d1d' }}>Vol</span>
                              </div>
                            </div>
                          )
                        }

                        // Last-one card: orange urgency
                        if (isLastOne) {
                          return (
                            <button key={w} onClick={() => { setSelectedWeek(w); setStep('form'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                              className="min-w-[300px] p-8 rounded-[2rem] text-left transition-all cursor-pointer"
                              style={{ background: '#fff7ed', border: '2px solid #f97316' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ffedd5' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fff7ed' }}
                            >
                              <div className="flex justify-between items-start mb-12">
                                <span className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-bold"
                                  style={{ background: '#f97316', color: '#fff' }}>
                                  Laatste scanner!
                                </span>
                                <span className="material-symbols-outlined" style={{ color: '#ea580c' }}>priority_high</span>
                              </div>
                              <h4 className="text-2xl mb-2" style={{ fontFamily: 'Noto Serif', color: '#7c2d12' }}>{formatWeekShort(w)}</h4>
                              <p className="text-sm mb-8 font-medium" style={{ color: '#c2410c' }}>Nog 1 scanner beschikbaar</p>
                              <div className="h-[1px] w-full mb-8" style={{ background: '#fed7aa' }}></div>
                              <div className="flex justify-between items-center">
                                <span className="text-xl" style={{ fontFamily: 'Noto Serif', color: '#7c2d12' }}>Gratis</span>
                                <span className="text-xs uppercase tracking-widest font-bold" style={{ color: '#c2410c' }}>Selecteer nu</span>
                              </div>
                            </button>
                          )
                        }

                        // Available card: green accent
                        return (
                          <button key={w} onClick={() => { setSelectedWeek(w); setStep('form'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                            className="min-w-[300px] p-8 rounded-[2rem] text-left transition-all cursor-pointer group"
                            style={{ background: '#f5f3ef', border: '1px solid #c3c8bf' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#253c27'; (e.currentTarget as HTMLElement).style.background = '#eaf0ea' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c3c8bf'; (e.currentTarget as HTMLElement).style.background = '#f5f3ef' }}
                          >
                            <div className="flex justify-between items-start mb-12">
                              <span className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-bold"
                                style={{ background: '#dbe6d7', color: '#253c27' }}>
                                Beschikbaar
                              </span>
                              <span className="material-symbols-outlined" style={{ color: '#253c27' }}>event_available</span>
                            </div>
                            <h4 className="text-2xl mb-2" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>{formatWeekShort(w)}</h4>
                            <p className="text-sm mb-8" style={{ color: '#434842' }}>Scanner direct beschikbaar</p>
                            <div className="h-[1px] w-full mb-8" style={{ background: 'rgba(195,200,191,0.5)' }}></div>
                            <div className="flex justify-between items-center">
                              <span className="text-xl" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Gratis</span>
                              <span className="text-xs uppercase tracking-widest font-bold" style={{ color: '#253c27' }}>Selecteer</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* Formulier */}
          {step === 'form' && (
            <section className="py-16 px-8 md:px-20">
              <div className="max-w-2xl mx-auto">
                <button onClick={() => setStep('landing')} className="mb-8 text-sm hover:opacity-70 transition-opacity flex items-center gap-2" style={{ color: '#253c27', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Manrope' }}>
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  Andere week kiezen
                </button>

                <div className="p-10 md:p-14 rounded-[2rem]" style={{ background: '#fff', border: '1px solid rgba(195,200,191,0.3)' }}>
                  <span className="text-[10px] uppercase tracking-widest mb-4 block" style={{ color: 'rgba(37,60,39,0.6)' }}>Geselecteerde week</span>
                  <h2 className="text-3xl mb-2" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>{formatWeekShort(selectedWeek)}</h2>
                  <p className="text-sm mb-10" style={{ color: '#737971' }}>{formatWeekLong(selectedWeek)}</p>

                  <div className="h-[1px] w-full mb-10" style={{ background: 'rgba(195,200,191,0.3)' }}></div>

                  <h3 className="text-xl mb-8" style={{ fontFamily: 'Noto Serif', color: '#253c27' }}>Jouw gegevens</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <FormInput label="Voornaam" value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} required />
                    <FormInput label="Achternaam" value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} required />
                    <FormInput label="E-mailadres" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required />
                    <FormInput label="Telefoonnummer" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} required />
                    <div className="md:col-span-2">
                      <FormInput label="Adres" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} required />
                    </div>
                    <FormInput label="Postcode" value={form.zip_code} onChange={v => setForm(f => ({ ...f, zip_code: v }))} required />
                    <FormInput label="Stad" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} required />
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#737971', fontFamily: 'Manrope' }}>Opmerkingen</label>
                      <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                        className="w-full px-5 py-4 rounded-xl text-sm focus:outline-none transition-all"
                        style={{ border: '1.5px solid #e4e2de', background: '#fbf9f5', fontFamily: 'Manrope', resize: 'vertical' }}
                        onFocus={e => (e.target.style.borderColor = '#253c27')}
                        onBlur={e => (e.target.style.borderColor = '#e4e2de')}
                      />
                    </div>
                  </div>

                  {error && <p className="text-sm mt-4" style={{ color: '#ba1a1a' }}>{error}</p>}

                  <div className="mt-10 p-6 rounded-2xl flex items-start gap-4" style={{ background: '#f5f3ef' }}>
                    <span className="material-symbols-outlined mt-0.5" style={{ color: '#253c27', fontSize: 20 }}>info</span>
                    <p className="text-sm leading-relaxed" style={{ color: '#434842' }}>
                      Er geldt een borg van <strong>&euro;200</strong> die je bij het reserveren via iDEAL betaalt. Deze wordt teruggestort zodra de scanner in goede staat retour is, of kan verrekend worden met de bestelling van een beeldje.
                    </p>
                  </div>

                  <button onClick={handleSubmit} disabled={submitting}
                    className="w-full mt-8 py-4 rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-all hover:opacity-90"
                    style={{ background: '#253c27', color: '#fff', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? 'Even geduld...' : 'Afrekenen — €200 borg via iDEAL'}
                    {!submitting && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
                  </button>
                </div>
              </div>
            </section>
          )}

        </main>
      </div>
    </>
  )
}

function FormInput({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#737971', fontFamily: 'Manrope' }}>
        {label}{required && ' *'}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-5 py-4 rounded-xl text-sm focus:outline-none transition-all"
        style={{ border: '1.5px solid #e4e2de', background: '#fbf9f5', fontFamily: 'Manrope' }}
        onFocus={e => (e.target.style.borderColor = '#253c27')}
        onBlur={e => (e.target.style.borderColor = '#e4e2de')}
      />
    </div>
  )
}
