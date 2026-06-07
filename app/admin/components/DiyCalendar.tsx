'use client'

import { useEffect, useState } from 'react'

interface ScannerCell {
  scanner_id: number
  scanner_name: string
  rental: {
    id: number
    first_name: string
    last_name: string
    customer_number: string | null
    status: string
  } | null
}
interface WeekRow {
  monday: string
  sunday: string
  blocked: boolean
  block_reason: string | null
  scanners: ScannerCell[]
  free_count: number
}
interface Scanner { id: number; name: string; is_available: boolean }

const STATUS_STYLE: Record<string, string> = {
  wacht_op_betaling: 'bg-amber-100 text-amber-800 border-amber-300',
  gereserveerd:      'bg-blue-100 text-blue-800 border-blue-300',
  verzonden:         'bg-purple-100 text-purple-800 border-purple-300',
  retour:            'bg-pink-100 text-pink-800 border-pink-300',
  uitzoeken:         'bg-orange-100 text-orange-800 border-orange-300',
  scans_uitgezocht:  'bg-green-100 text-green-800 border-green-300',
}
const STATUS_LABEL: Record<string, string> = {
  wacht_op_betaling: 'wacht op betaling',
  gereserveerd: 'gereserveerd',
  verzonden: 'verzonden',
  retour: 'retour',
  uitzoeken: 'uitzoeken',
  scans_uitgezocht: 'scans uitgezocht',
}

function fmtRange(monday: string, sunday: string): string {
  const m = new Date(monday + 'T00:00:00')
  const s = new Date(sunday + 'T00:00:00')
  const md = m.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  const sd = s.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `${md} – ${sd}`
}

export default function DiyCalendar({ onOpenRental }: { onOpenRental?: (rentalId: number) => void }) {
  const [weeks, setWeeks] = useState<WeekRow[]>([])
  const [scanners, setScanners] = useState<Scanner[]>([])
  const [loading, setLoading] = useState(true)
  const [weeksAhead, setWeeksAhead] = useState(16)

  const load = async (n: number) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/diy-calendar?weeks=${n}`, { credentials: 'include' })
      const d = await r.json()
      if (r.ok) { setWeeks(d.weeks ?? []); setScanners(d.scanners ?? []) }
    } finally { setLoading(false) }
  }
  useEffect(() => { load(weeksAhead) }, [weeksAhead])

  const todayMonday = (() => {
    const t = new Date(); const dow = (t.getDay() + 6) % 7
    t.setDate(t.getDate() - dow)
    return t.toISOString().slice(0, 10)
  })()

  if (loading && weeks.length === 0) {
    return <p className="text-sm text-gravida-light-sage">Kalender laden...</p>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-xs text-gravida-light-sage">
          Groen = vrij te boeken · gekleurd = verhuurd (klik voor details) · grijs = geblokkeerd
        </p>
        <div className="flex gap-1">
          {[8, 16, 26, 52].map(n => (
            <button key={n} onClick={() => setWeeksAhead(n)}
              className={`text-xs px-2 py-1 rounded ${weeksAhead === n ? 'bg-gravida-sage text-white' : 'bg-gravida-cream text-gravida-sage hover:bg-gravida-off-white'}`}>
              {n} wk
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto card p-0">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gravida-cream/50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap w-40">Week</th>
              {scanners.map(s => (
                <th key={s.id} className="text-left px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap">
                  {s.name}
                  {!s.is_available && <span className="ml-1 text-[10px] text-red-500">(uit roulatie)</span>}
                </th>
              ))}
              <th className="text-center px-3 py-2 font-medium text-gravida-light-sage whitespace-nowrap w-16">Vrij</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(w => {
              const isThisWeek = w.monday === todayMonday
              return (
                <tr key={w.monday} className={`border-t border-gravida-cream ${w.blocked ? 'bg-gray-100' : isThisWeek ? 'bg-gravida-green/5' : ''}`}>
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    <div className={`font-medium ${isThisWeek ? 'text-gravida-green' : 'text-gravida-sage'}`}>
                      {fmtRange(w.monday, w.sunday)}
                      {isThisWeek && <span className="ml-1 text-[10px] bg-gravida-green text-white px-1.5 py-0.5 rounded-full">nu</span>}
                    </div>
                    {w.blocked && (
                      <div className="text-[11px] text-gray-500 mt-0.5">🚫 {w.block_reason || 'geblokkeerd'}</div>
                    )}
                  </td>
                  {w.scanners.map(cell => (
                    <td key={cell.scanner_id} className="px-2 py-2 align-top">
                      {w.blocked ? (
                        <span className="text-[11px] text-gray-400">—</span>
                      ) : cell.rental ? (
                        <button
                          onClick={() => onOpenRental?.(cell.rental!.id)}
                          className={`w-full text-left text-[11px] px-2 py-1 rounded border ${STATUS_STYLE[cell.rental.status] ?? 'bg-gray-100 text-gray-700 border-gray-300'} hover:opacity-80`}
                          title={`${cell.rental.first_name} ${cell.rental.last_name} — ${STATUS_LABEL[cell.rental.status] ?? cell.rental.status}`}
                        >
                          <span className="font-medium truncate block">{cell.rental.first_name} {cell.rental.last_name.charAt(0)}.</span>
                          <span className="opacity-75">{STATUS_LABEL[cell.rental.status] ?? cell.rental.status}</span>
                        </button>
                      ) : (
                        <span className="block text-center text-[11px] text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">vrij</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center align-top">
                    <span className={`text-xs font-semibold ${w.free_count === 0 ? 'text-red-500' : 'text-gravida-green'}`}>
                      {w.blocked ? '—' : w.free_count}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
