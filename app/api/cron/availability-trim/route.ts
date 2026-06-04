import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Trim de beschikbaarheid voor de volgende week tot maximaal één tijdsblok
 * per regio per dag. Bestaande boekingen blijven beschermd: als één van
 * de bestaande slots geboekt is, blijft die behouden.
 *
 * Schema in vercel.json:
 *   { "path": "/api/cron/availability-trim", "schedule": "0 18 * * 5" }
 *   (vrijdag 18:00 UTC = 20:00 NL zomertijd / 19:00 wintertijd)
 *
 * Wat het doet, per regio per dag in week starting (next Monday):
 *   - 0 of 1 slot → niets doen
 *   - meerdere slots: behoud alle geboekte slots + 1 open slot, zodat
 *     er per regio per dag altijd nog precies één boekingsmogelijkheid
 *     openstaat naast de bestaande boekingen.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Bepaal volgende maandag (NL tijd benadering: gebruik UTC dates)
    const today = new Date()
    const dow = today.getUTCDay()  // 0 = sunday
    const daysUntilMon = (8 - dow) % 7 || 7
    const monday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysUntilMon))
    const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6)

    const fromIso = monday.toISOString().slice(0, 10)
    const toIso = sunday.toISOString().slice(0, 10)

    const rows = await sql<{ id: number; date: string; region: string; slots: string[] }>`
      SELECT id, date::text AS date, region, slots
      FROM availability
      WHERE date >= ${fromIso}::date AND date <= ${toIso}::date
        AND is_active = TRUE AND is_closed = FALSE
    `

    const summary: Array<{ id: number; date: string; region: string; before: string[]; after: string[]; reason: string }> = []
    for (const row of rows.rows) {
      const allSlots = Array.isArray(row.slots) ? row.slots : []
      if (allSlots.length <= 1) continue

      // Welke slots zijn al geboekt?
      const bookings = await sql<{ time_slot: string }>`
        SELECT DISTINCT time_slot FROM bookings
        WHERE availability_id = ${row.id} AND status != 'geannuleerd'
      `
      const bookedSlots = bookings.rows.map(r => r.time_slot)
      const bookedInRow = allSlots.filter(s => bookedSlots.includes(s))
      const openInRow = allSlots.filter(s => !bookedSlots.includes(s))

      // Behoud alle geboekte slots + 1 open slot (eerste beschikbare)
      const extraOpen = openInRow.length > 0 ? [openInRow[0]] : []
      const keep = [...bookedInRow, ...extraOpen]
      const reason = bookedInRow.length > 0
        ? `${bookedInRow.length} geboekt + 1 open behouden`
        : '1 open slot behouden'

      if (keep.length === allSlots.length) continue

      await sql`
        UPDATE availability SET slots = ${JSON.stringify(keep)}::jsonb
        WHERE id = ${row.id}
      `
      summary.push({ id: row.id, date: row.date, region: row.region, before: allSlots, after: keep, reason })
    }

    return NextResponse.json({
      ok: true,
      week: { from: fromIso, to: toIso },
      checked: rows.rows.length,
      trimmed: summary.length,
      summary,
    })
  } catch (err) {
    console.error('cron/availability-trim error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
