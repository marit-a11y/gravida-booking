import { sql } from '@vercel/postgres'
import { DISPLAY_SLOTS_BY_REGION, getDisplaySlotsForRegion } from '@/lib/region-slots'

/**
 * Bouwt een overzicht van scanmomenten per regio voor de komende week,
 * EXACT zoals een bezoeker ze op de website ziet (niet de ruwe backend-tijden).
 *
 * Per dag tonen we het volledige "universum" van tijden zoals de site:
 *   universe = availability.slots ∪ blocked_slots ∪ display-set (per regio)
 *
 * en per tijd of die vrij of vol is, met dezelfde logica als
 * /api/availability/[id]:
 *   - vrij  = staat in availability.slots, niet geblokkeerd, en niet vol
 *   - vol   = geblokkeerd, buiten de bookable-set (display-filler), of volgeboekt
 *
 * Een dag/regio verschijnt alleen als die minstens 1 vrije tijd heeft.
 * Voorwaarden voor de dag zelf (zoals de site): is_active = true,
 * is_closed = false, en minstens 1 actieve staf dekt de regio en is niet
 * afwezig op die dag.
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

export interface SlotStatus { time: string; free: boolean }
export interface RegionDayFree { date: string; weekday: string; dateLabel: string; slots: SlotStatus[] }
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

  // Alleen de vaste aan-huis-regio's met een eigen site-tijdenset.
  // Andere regio's (bv. studioscans) hebben geen curated display-set en
  // horen niet in dit per-regio overzicht.
  const knownRegions = new Set(Object.keys(DISPLAY_SLOTS_BY_REGION))

  const byRegion = new Map<string, RegionDayFree[]>()
  for (const a of rows) {
    if (!knownRegions.has(a.region)) continue
    const bookable = new Set(Array.isArray(a.slots) ? a.slots : [])
    const blocked = new Set(Array.isArray(a.blocked_slots) ? a.blocked_slots : [])
    const display = getDisplaySlotsForRegion(a.region)

    // Universum = bookable ∪ geblokkeerd ∪ display-fillers, gesorteerd op tijd.
    const universe = [...new Set([...bookable, ...blocked, ...display])].sort()

    const slots: SlotStatus[] = universe.map(time => {
      const isOutsideBookable = !bookable.has(time)
      const isExplicitBlocked = blocked.has(time)
      const count = bookable.has(time) ? (counts.get(`${a.id}|${time}`) ?? 0) : 0
      const isFull = count >= a.max_per_slot
      const free = !isOutsideBookable && !isExplicitBlocked && !isFull
      return { time, free }
    })

    // Alleen dagen met minstens 1 vrije tijd tonen.
    if (!slots.some(s => s.free)) continue

    const day: RegionDayFree = {
      date: a.date,
      weekday: nlLabel(a.date, { weekday: 'short' }),
      dateLabel: nlLabel(a.date, { day: 'numeric', month: 'short' }),
      slots,
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
      const cells = d.slots.map(s => `${s.time} ${s.free ? 'vrij' : 'vol'}`).join(' | ')
      lines.push(`  ${d.weekday} ${d.dateLabel}: ${cells}`)
    }
    lines.push('')
  }
  lines.push(updated)
  return lines.join('\n').trimEnd()
}
