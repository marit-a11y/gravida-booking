import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { generateStandardAvailability } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const BOOKABLE_REGIONS = [
  'Noord-Holland & Flevoland',
  'Utrecht & Gelderland & Overijssel',
  'Zuid-Holland',
  'Noord-Brabant',
  'Limburg',
  'Groningen, Friesland en Drenthe',
]

/**
 * Batch cleanup voor de NL aan-huis regio's:
 * 1. Verwijder alle aan-huis availability vanaf vandaag waar GEEN boekingen
 *    aan gekoppeld zijn (bookings blijven onaangetast).
 * 2. Roep de standaard generator aan zodat alles opnieuw aangemaakt wordt
 *    volgens de huidige regels (korte/lange dag, reistijdbuffer, etc).
 *
 * Studio regio's (Haarlem studioscan / Family scan / Showroom), Curacao en
 * DIY blijven volledig ongemoeid.
 */
export async function POST() {
  try {
    const regionsJson = JSON.stringify(BOOKABLE_REGIONS)

    // Stap 1: hard-verwijder alle aan-huis entries vanaf vandaag zonder bookings
    const deleted = await sql`
      DELETE FROM availability a
      WHERE a.date >= CURRENT_DATE
        AND ${regionsJson}::jsonb @> jsonb_build_array(a.region)
        AND NOT EXISTS (
          SELECT 1 FROM bookings b WHERE b.availability_id = a.id
        )
    `

    // Stap 2: tel hoeveel entries we behielden vanwege bookings
    const kept = await sql`
      SELECT COUNT(*) as count FROM availability a
      WHERE a.date >= CURRENT_DATE
        AND ${regionsJson}::jsonb @> jsonb_build_array(a.region)
    `
    const keptCount = parseInt(kept.rows[0].count, 10)

    // Stap 3: regenereer met huidige regels
    const inserted = await generateStandardAvailability(12)

    return NextResponse.json({
      ok: true,
      deleted: deleted.rowCount ?? 0,
      kept_with_bookings: keptCount,
      regenerated: inserted,
    })
  } catch (err) {
    console.error('regenerate-bookable error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
