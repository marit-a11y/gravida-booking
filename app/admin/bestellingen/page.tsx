'use client'

import { useCallback, useEffect, useState } from 'react'

interface WooOrderLine {
  id: number
  name: string
  quantity: number
  subtotal: string
  total: string
  sku?: string
}
interface WooOrder {
  id: number
  number: string
  status: string
  currency: string
  date_created: string
  date_paid: string | null
  total: string
  shipping_total: string
  discount_total: string
  payment_method_title: string
  customer_note?: string
  billing: {
    first_name: string; last_name: string; email: string; phone: string
    address_1: string; address_2: string; postcode: string; city: string; country: string
  }
  shipping: {
    first_name: string; last_name: string
    address_1: string; address_2: string; postcode: string; city: string; country: string
  }
  line_items: WooOrderLine[]
  coupon_lines?: { code: string; discount: string }[]
}

const STATUS_STYLES: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-700',
  'on-hold':  'bg-orange-100 text-orange-700',
  completed:  'bg-green-100 text-green-700',
  cancelled:  'bg-gray-200 text-gray-600',
  refunded:   'bg-red-100 text-red-700',
  failed:     'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'In afwachting',
  processing: 'In behandeling',
  'on-hold': 'Wacht op betaling',
  completed: 'Voltooid',
  cancelled: 'Geannuleerd',
  refunded: 'Terugbetaald',
  failed: 'Mislukt',
}

function fmtEuro(value: string, currency = 'EUR') {
  const n = parseFloat(value || '0')
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(n)
}
function fmtDate(iso: string | null) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })
}

export default function BestellingenPage() {
  const [orders, setOrders] = useState<WooOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | string>('all')
  const [openId, setOpenId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({ page: String(page), status })
      if (search.trim()) params.set('search', search.trim())
      const r = await fetch(`/api/admin/woo-orders?${params.toString()}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok) {
        setError(d.error ?? 'Bestellingen laden mislukt')
        setOrders([])
      } else {
        setOrders(d.orders ?? [])
        setTotalPages(d.totalPages ?? 1)
        setTotalCount(d.totalCount ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, status, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Bestellingen webshop</h1>
          <p className="text-gravida-sage mt-1 text-sm">
            Live overzicht van orders uit de Gravida webshop ({totalCount > 0 ? `${totalCount} totaal` : '...'})
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary text-sm disabled:opacity-50">
          {loading ? 'Laden...' : '↻ Vernieuwen'}
        </button>
      </div>

      <div className="card mb-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Zoek op naam, e-mail, ordernr..."
          className="input-field flex-1 min-w-[220px]"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <div className="flex gap-1 flex-wrap">
          {(['all', 'processing', 'on-hold', 'pending', 'completed', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1) }}
              className={`text-xs px-3 py-1.5 rounded-full ${status === s
                ? 'bg-gravida-sage text-white'
                : 'bg-white border border-gravida-cream text-gravida-sage hover:border-gravida-sage'}`}>
              {s === 'all' ? 'Alle statussen' : STATUS_LABELS[s] ?? s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card mb-4 bg-red-50 border-red-200">
          <p className="text-sm text-red-700"><strong>Verbinding met webshop mislukt:</strong> {error}</p>
          <p className="text-xs text-red-600 mt-2">
            Controleer of <code>WOOCOMMERCE_URL</code>, <code>WOOCOMMERCE_KEY</code> en <code>WOOCOMMERCE_SECRET</code> in Vercel env vars staan.
          </p>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <p className="text-sm text-gravida-light-sage">Laden...</p>
      ) : !loading && orders.length === 0 ? (
        <p className="text-sm text-gravida-light-sage italic">Geen bestellingen gevonden.</p>
      ) : (
        <div className="space-y-2">
          {orders.map(o => {
            const isOpen = openId === o.id
            const itemCount = o.line_items.reduce((s, l) => s + l.quantity, 0)
            return (
              <div key={o.id} className="card p-0 overflow-hidden">
                <button onClick={() => setOpenId(isOpen ? null : o.id)}
                  className="w-full text-left p-4 hover:bg-gravida-off-white transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-gravida-sage">#{o.number}</span>
                        <h3 className="font-semibold text-gravida-green">{o.billing.first_name} {o.billing.last_name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </div>
                      <p className="text-xs text-gravida-sage mt-1">
                        {fmtDate(o.date_created)} · {o.billing.email} · {itemCount} product{itemCount === 1 ? '' : 'en'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gravida-green">{fmtEuro(o.total, o.currency)}</p>
                      <p className="text-[11px] text-gravida-light-sage">{o.payment_method_title || '-'}</p>
                      <p className="text-[11px] mt-1">{isOpen ? '▲ inklappen' : '▼ openen'}</p>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-gravida-cream p-4 bg-gravida-off-white/40 space-y-4">
                    {/* Bestelregels */}
                    <div>
                      <h4 className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide mb-2">Bestelregels</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] text-gravida-light-sage border-b border-gravida-cream">
                            <th className="text-left py-1 font-medium">Product</th>
                            <th className="text-right py-1 font-medium">Aantal</th>
                            <th className="text-right py-1 font-medium">Subtotaal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.line_items.map(li => (
                            <tr key={li.id} className="border-b border-gravida-cream last:border-0">
                              <td className="py-2 pr-2">
                                {li.name}
                                {li.sku && <span className="text-[10px] text-gravida-light-sage ml-2">SKU: {li.sku}</span>}
                              </td>
                              <td className="py-2 text-right text-gravida-sage">×{li.quantity}</td>
                              <td className="py-2 text-right font-medium">{fmtEuro(li.subtotal, o.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {o.coupon_lines && o.coupon_lines.length > 0 && o.coupon_lines.map((c, i) => (
                            <tr key={i} className="text-xs text-gravida-sage">
                              <td colSpan={2} className="py-1 pr-2">Kortingscode <code>{c.code}</code></td>
                              <td className="py-1 text-right">- {fmtEuro(c.discount, o.currency)}</td>
                            </tr>
                          ))}
                          {parseFloat(o.shipping_total) > 0 && (
                            <tr className="text-xs text-gravida-sage">
                              <td colSpan={2} className="py-1 pr-2">Verzendkosten</td>
                              <td className="py-1 text-right">{fmtEuro(o.shipping_total, o.currency)}</td>
                            </tr>
                          )}
                          <tr className="font-semibold border-t border-gravida-cream">
                            <td colSpan={2} className="py-2 pr-2 text-gravida-green">Totaal</td>
                            <td className="py-2 text-right text-gravida-green">{fmtEuro(o.total, o.currency)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Verzendadres */}
                    {(o.shipping.address_1 || o.shipping.city) && (
                      <div>
                        <h4 className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide mb-1">Verzendadres</h4>
                        <p className="text-sm text-gravida-green">
                          {o.shipping.first_name} {o.shipping.last_name}<br />
                          {o.shipping.address_1} {o.shipping.address_2}<br />
                          {o.shipping.postcode} {o.shipping.city}<br />
                          {o.shipping.country}
                        </p>
                      </div>
                    )}

                    {/* Klantnotitie */}
                    {o.customer_note && (
                      <div>
                        <h4 className="text-xs font-semibold text-gravida-light-sage uppercase tracking-wide mb-1">Notitie van klant</h4>
                        <p className="text-sm italic text-gravida-sage whitespace-pre-wrap">{o.customer_note}</p>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="text-[11px] text-gravida-light-sage flex flex-wrap gap-3 pt-1 border-t border-gravida-cream">
                      <span>Besteld: {fmtDate(o.date_created)}</span>
                      <span>Betaald: {o.date_paid ? fmtDate(o.date_paid) : 'nog niet'}</span>
                      <span>Telefoon: {o.billing.phone || '-'}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginatie */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="text-xs px-3 py-1.5 rounded border border-gravida-cream text-gravida-sage hover:border-gravida-sage disabled:opacity-40">
            ← Vorige
          </button>
          <span className="text-xs text-gravida-sage">Pagina {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="text-xs px-3 py-1.5 rounded border border-gravida-cream text-gravida-sage hover:border-gravida-sage disabled:opacity-40">
            Volgende →
          </button>
        </div>
      )}
    </div>
  )
}
