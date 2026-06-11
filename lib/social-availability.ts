import { sql } from '@vercel/postgres'
import { DISPLAY_SLOTS_BY_REGION } from '@/lib/region-slots'

/**
 * Bouwt een overzicht van VRIJE scanmomenten per regio voor de komende week,
 * met exact dezelfde "vrij"-definitie als de voorkant van de website:
 *
 *   - availability is_active = true EN is_closed = false
 *   - minstens 1 actieve staf dekt de regio en is niet afwezig op die dag
 *   - het slot staat in availability.slots (bookable)
 *   - het slot staat NIET in blocked_slots
 *   - aantal niet-geannuleerde boekingen < max_per_slot
 *
 * Wordt gebruikt door de zondag-cron om een notitie bij de social-post
 * "Komende week vrije tijden" te zetten.
 */

const NL_TZ = 'Europe/Amsterdam'

function nlTodayParts(now: Date): { y: number; m: number; d: number } {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: NL_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function ymd(dt: Date): string { return dt.toISOString().slice(0, 10) }

/**
 * Bepaalt de komende week (maandag t/m zondag) vanaf het moment dat de
 * cron draait. Op een zondag is dat de eerstvolgende maandag t/m zondag.
 * Retourneert { start, end } als YYYY-MM-DD waarbij end EXCLUSIEF is.
 */
export function comingWeekRange(now: Date): { start: string; end: string } {
  const { y, m, d } = nlTodayParts(now)
  const today = new Date(Date.UTC(y, m - 1, d))
  const isoDow = ((today.getUTCDay() + 6) % 7) + 1 // 1 = ma ... 7 = zo
  let add = (8 - isoDow) % 7
  if (add === 0) add = 7 // op maandag willen we de VOLGENDE week
  const start = new Date(today.getTime() + add * 86400000)
  const end = new Date(start.getTime() + 7 * 86400000)
  return { start: ymd(start), end: ymd(end) }
}

function nlLabel(ymdStr: string, opts: Intl.DateTimeFormatOptions): string {
  // Middag-UTC voorkomt datum-rollover bij tijdzone-conversie.
  const d = new Date(ymdStr + 'T12:00:00Z')
  return new Intl.DateTimeFormat('nl-NL', { timeZone: NL_TZ, ...opts }).format(d)
}

export interface RegionDayFree { date: string; weekday: string; dateLabel: string; slots: string[] }
export interface RegionFree { region: string; days: RegionDayFree[] }

export async function getFreeSlotsForWeek(start: string, end: string): Promise<RegionFree[]> {
  const av = await sql<{
    id: number; date: string; region: string; slots: string[]; max_per_slot: number; blocked_slots: string[] | null
  }>`
    SELECT a.id, a.date::text, a.region, a.slots, a.max_per_slot, a.blocked_slots
    FROM availability a
    WHERE a.is_active = true AND a.is_closed = false
      AND a.date >= ${start}::date AND a.date < ${end}::date
      AND EXISTS (
        SELECT 1 FROM staff s
        WHERE s.is_active = true
          AND s.regions::jsonb @> to_jsonb(ARRAY[a.region])
          AND NOT EXISTS (
            SELECT 1 FROM absence ab
            WHERE ab.staff_id = s.id
              AND ab.date_from <= a.date
              AND ab.date_to >= a.date
          )
      )
    ORDER BY a.region ASC, a.date ASC
  `
  const rows = av.rows
  const ids = rows.map(r => r.id)

  // Boekingstellingen per (availability, slot) in 1 query.
  const counts = new Map<string, number>()
  if (ids.length) {
    const c = await sql<{ availability_id: number; time_slot: string; count: string }>`
      SELECT availability_id, time_slot, COUNT(*)::text AS count
      FROM bookings
      WHERE availability_id = ANY(${ids as unknown as number}::int[]) AND status != 'geannuleerd'
      GROUP BY availability_id, time_slot
    `
    for (const r of c.rows) counts.set(`${r.availability_id}|${r.time_slot}`, parseInt(r.count, 10))
  }

  const byRegion = new Map<string, RegionDayFree[]>()
  for (const a of rows) {
    const blocked = new Set(Array.isArray(a.blocked_slots) ? a.blocked_slots : [])
    const free = (Array.isArray(a.slots) ? a.slots : [])
      .filter(s => !blocked.has(s))
      .filter(s => (counts.get(`${a.id}|${s}`) ?? 0) < a.max_per_slot)
      .sort()
    if (free.length === 0) continue
    const day: RegionDayFree = {
      date: a.date,
      weekday: nlLabel(a.date, { weekday: 'short' }),
      dateLabel: nlLabel(a.date, { day: 'numeric', month: 'short' }),
      slots: free,
    }
    if (!byRegion.has(a.region)) byRegion.set(a.region, [])
    byRegion.get(a.region)!.push(day)
  }

  // Regio-volgorde gelijk aan de website (sleutels van DISPLAY_SLOTS_BY_REGION),
  // onbekende regio's daarna alfabetisch.
  const order = Object.keys(DISPLAY_SLOTS_BY_REGION)
  const regions = [...byRegion.keys()].sort((a, b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    return a.localeCompare(b, 'nl')
  })
  return regions.map(region => ({ region, days: byRegion.get(region)! }))
}

/** Tekstuele notitie voor in de social-post (internal_notes). */
export function formatFreeSlotsNote(weeks: RegionFree[], range: { start: string; end: string }, now: Date): string {
  const endInclusive = ymd(new Date(new Date(range.end + 'T12:00:00Z').getTime() - 86400000))
  const header = `Vrije tijden komende week (${nlLabel(range.start, { weekday: 'short', day: 'numeric', month: 'short' })} t/m ${nlLabel(endInclusive, { weekday: 'short', day: 'numeric', month: 'short' })})`
  const updated = `Bijgewerkt ${new Intl.DateTimeFormat('nl-NL', { timeZone: NL_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(now)} uur. Bron: live beschikbaarheid op de website.`

  if (weeks.length === 0) {
    return `${header}\n\nGeen vrije tijden komende week (volgeboekt of nog niet opengezet).\n\n${updated}`
  }

  const lines: string[] = [header, '']
  for (const r of weeks) {
    lines.push(r.region)
    for (const d of r.days) {
      lines.push(`  ${d.weekday} ${d.dateLabel}: ${d.slots.join(', ')}`)
    }
    lines.push('')
  }
  lines.push(updated)
  return lines.join('\n').trimEnd()
}
