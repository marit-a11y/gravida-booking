import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

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

/**
 * Calendar-overzicht voor DIY verhuur.
 * Geeft per week (maandag) een rij terug met per scanner of die vrij of
 * verhuurd is, plus blokkades (zomerstop etc).
 *
 * Query: ?weeks=16 (default 16 weken vooruit)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weeksAhead = Math.min(parseInt(searchParams.get('weeks') ?? '16', 10) || 16, 52)

    // Scanners (inventaris)
    const scanners = await sql<{ id: number; name: string; is_available: boolean }>`
      SELECT id, name, is_available FROM diy_scanners ORDER BY id ASC
    `

    // Genereer komende maandagen (start: deze week's maandag, zodat huidige week ook zichtbaar is)
    const now = new Date()
    const start = new Date(now)
    const dow = (start.getDay() + 6) % 7 // 0 = maandag
    start.setDate(start.getDate() - dow)  // terug naar maandag van deze week
    const mondays: string[] = []
    for (let i = 0; i < weeksAhead; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i * 7)
      mondays.push(d.toISOString().slice(0, 10))
    }
    const firstMon = mondays[0]
    const lastMon = mondays[mondays.length - 1]

    // Verhuringen in de range (actieve + retour-flow, niet geannuleerd)
    const rentals = await sql<{
      id: number; scanner_id: number | null; rental_week: string
      first_name: string; last_name: string; customer_number: string | null; status: string
    }>`
      SELECT id, scanner_id, rental_week::text AS rental_week,
             first_name, last_name, customer_number, status
      FROM diy_rentals
      WHERE rental_week >= ${firstMon}::date AND rental_week <= ${lastMon}::date
        AND status != 'geannuleerd'
      ORDER BY rental_week ASC
    `

    // Blokkades
    const blocks = await sql<{ date_from: string; date_to: string; reason: string | null }>`
      SELECT date_from::text AS date_from, date_to::text AS date_to, reason FROM diy_blocks
    `

    const rows: WeekRow[] = mondays.map(monday => {
      const sundayD = new Date(monday + 'T00:00:00'); sundayD.setDate(sundayD.getDate() + 6)
      const sunday = sundayD.toISOString().slice(0, 10)

      // Block-overlap check
      const block = blocks.rows.find(b => b.date_from <= sunday && b.date_to >= monday)

      // Welke verhuringen vallen in deze week
      const weekRentals = rentals.rows.filter(r => r.rental_week === monday)

      const scannerCells: ScannerCell[] = scanners.rows.map(sc => {
        const rental = weekRentals.find(r => r.scanner_id === sc.id)
        return {
          scanner_id: sc.id,
          scanner_name: sc.name,
          rental: rental ? {
            id: rental.id,
            first_name: rental.first_name,
            last_name: rental.last_name,
            customer_number: rental.customer_number,
            status: rental.status,
          } : null,
        }
      })

      // Verhuringen zonder toegewezen scanner (scanner_id null) — tel ook mee als bezet
      const unassigned = weekRentals.filter(r => !r.scanner_id)
      // Vrije scanners = beschikbare scanners zonder verhuur, minus unassigned bookings
      const availableScanners = scanners.rows.filter(s => s.is_available)
      const bookedScannerIds = new Set(weekRentals.filter(r => r.scanner_id).map(r => r.scanner_id))
      const freeCount = block ? 0 : Math.max(0, availableScanners.filter(s => !bookedScannerIds.has(s.id)).length - unassigned.length)

      return {
        monday,
        sunday,
        blocked: !!block,
        block_reason: block?.reason ?? null,
        scanners: scannerCells,
        free_count: freeCount,
      }
    })

    return NextResponse.json({
      scanners: scanners.rows,
      weeks: rows,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
