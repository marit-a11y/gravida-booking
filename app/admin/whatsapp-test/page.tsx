'use client'

import { useEffect, useState } from 'react'

interface ConfigStatus {
  configured: boolean
  env: Record<string, string>
}

interface TestResult {
  ok: boolean
  template?: string
  params?: string[]
  to?: string
  error?: string
  response?: unknown
}

export default function WhatsappTestPage() {
  const [status, setStatus] = useState<ConfigStatus | null>(null)
  const [overrideTo, setOverrideTo] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)

  useEffect(() => {
    fetch('/api/admin/whatsapp-test').then(r => r.json()).then(setStatus)
  }, [])

  const sendTest = async (template: string) => {
    setSending(template); setResult(null)
    try {
      const res = await fetch('/api/admin/whatsapp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template,
          to: overrideTo.trim() || undefined,
        }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ ok: false, error: String(err) })
    } finally {
      setSending(null)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">WhatsApp test</h1>
        <p className="text-gravida-sage mt-1 text-sm">Check of de WhatsApp Cloud API correct is ingesteld en stuur een test-bericht.</p>
      </div>

      {/* Status */}
      <div className="card mb-6">
        <h2 className="section-title mb-3">⚙️ Configuratie status</h2>
        {!status ? (
          <p className="text-sm text-gravida-light-sage">Laden...</p>
        ) : (
          <div className="space-y-2">
            <div className={`p-3 rounded-lg ${status.configured ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`font-medium text-sm ${status.configured ? 'text-green-800' : 'text-red-800'}`}>
                {status.configured ? '✓ Alle vereiste env vars zijn ingesteld' : '✗ Niet alle env vars zijn ingesteld'}
              </p>
            </div>
            <table className="w-full text-xs font-mono">
              <tbody>
                {Object.entries(status.env).map(([k, v]) => (
                  <tr key={k} className="border-b border-gravida-cream/50 last:border-0">
                    <td className="py-1.5 pr-3 text-gravida-light-sage">{k}</td>
                    <td className="py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!status.configured && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                <p className="font-semibold">📝 Hoe instellen:</p>
                <p>Vercel project → <strong>Settings</strong> → <strong>Environment Variables</strong> → Add:</p>
                <ul className="ml-4 space-y-0.5 list-disc">
                  <li><code>WHATSAPP_ACCESS_TOKEN</code> — System User token uit Meta Business</li>
                  <li><code>WHATSAPP_PHONE_NUMBER_ID</code> — uit Meta WhatsApp Manager → Phone numbers</li>
                  <li><code>WHATSAPP_TO</code> — jouw nummer zonder + (bijv. <code>31612345678</code>)</li>
                </ul>
                <p className="mt-1">Daarna redeploy → terug naar deze pagina → status zou groen moeten zijn.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test sender */}
      <div className="card mb-6">
        <h2 className="section-title mb-3">📤 Stuur test-bericht</h2>
        <div className="space-y-3">
          <div>
            <label className="label">Naar nummer (optioneel — overschrijft WHATSAPP_TO env var)</label>
            <input className="input-field" placeholder="31612345678 (zonder +)"
              value={overrideTo} onChange={e => setOverrideTo(e.target.value)} />
            <p className="text-[11px] text-gravida-light-sage mt-1">
              Leeg laten = gebruikt het nummer uit de env var. Belangrijk: het ontvangende nummer moet als <strong>verified test recipient</strong> staan in Meta WhatsApp Manager → Phone numbers (anders weigert Meta de levering).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => sendTest('reminder')} disabled={!!sending}
              className="btn-primary text-sm">
              {sending === 'reminder' ? '⏳ Bezig...' : '📅 Test post-reminder'}
            </button>
            <button onClick={() => sendTest('content_missing')} disabled={!!sending}
              className="btn-secondary text-sm">
              {sending === 'content_missing' ? '⏳ Bezig...' : '⚠️ Test content-missing'}
            </button>
            <button onClick={() => sendTest('hello_world')} disabled={!!sending}
              className="btn-secondary text-sm">
              {sending === 'hello_world' ? '⏳ Bezig...' : '👋 Test hello_world (Meta default)'}
            </button>
          </div>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="card">
          <h2 className="section-title mb-3">
            {result.ok ? '✅ Verstuurd!' : '❌ Mislukt'}
          </h2>
          <div className="space-y-3 text-sm">
            <div className={`p-3 rounded-lg ${result.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.ok ? (
                <p className="text-green-800">
                  Bericht verstuurd naar <code className="bg-white px-1 rounded">{result.to}</code> via template <code className="bg-white px-1 rounded">{result.template}</code>.
                  Check je WhatsApp! Als-ie niet binnenkomt: het ontvangende nummer is waarschijnlijk niet als test recipient toegevoegd in Meta.
                </p>
              ) : (
                <div className="text-red-800 space-y-1">
                  <p className="font-medium">{result.error}</p>
                  {result.error?.includes('131030') && (
                    <p className="text-xs">→ Dit nummer staat niet als <strong>verified test recipient</strong>. Voeg toe in Meta WhatsApp Manager → Phone numbers → klik op het test-nummer → To phone numbers.</p>
                  )}
                  {result.error?.includes('132000') && (
                    <p className="text-xs">→ Aantal parameters klopt niet met de template. Check of de template approved is met dezelfde {`{{1}} {{2}} {{3}}`} structuur als verwacht.</p>
                  )}
                  {result.error?.includes('132001') && (
                    <p className="text-xs">→ Template bestaat niet of is niet approved. Check naam in Meta WhatsApp Manager.</p>
                  )}
                  {result.error?.includes('190') && (
                    <p className="text-xs">→ Access token verlopen. Maak een nieuwe System User token aan in Meta Business Settings.</p>
                  )}
                </div>
              )}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-gravida-light-sage hover:text-gravida-sage">Volledige API response</summary>
              <pre className="bg-gravida-cream/30 p-3 rounded-lg mt-2 overflow-x-auto text-[11px] font-mono whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  )
}
