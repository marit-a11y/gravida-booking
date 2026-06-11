import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createSocialPost } from '@/lib/db'
import { nlLocalToIso, getNlHourMinute, getNlDateKey } from '@/lib/nl-time'
import { comingWeekRange, getFreeSlotsForWeek, formatFreeSlotsNote } from '@/lib/social-availability'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Zondag-cron (zie vercel.json). Zet een overzicht van de vrije scanmomenten
 * per regio voor de komende week als notitie (internal_notes) bij de
 * social-post van 15:00 "Komende week vrije tijden".
 *
 * - Vindt een post op de huidige zondag die op "vrije tijden" lijkt of om
 *   15:00 NL staat; werkt daar de notitie bij.
 * - Bestaat er geen passende post? Dan maakt de cron er een aan (story, 15:00).
 * - De notitie staat in een beheerd blok zodat handmatige notities blijven staan.
 */

const BLOCK_START = '[vrije-tijden:start]'
const BLOCK_END = '[vrije-tijden:einde]'

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function applyManagedBlock(existing: string | null, body: string): string {
  const block = `${BLOCK_START}\n${body}\n${BLOCK_END}`
  if (existing && existing.includes(BLOCK_START) && existing.includes(BLOCK_END)) {
    const re = new RegExp(escapeRe(BLOCK_START) + '[\\s\\S]*?' + escapeRe(BLOCK_END))
    return existing.replace(re, block)
  }
  return existing && existing.trim() ? existing.trimEnd() + '\n\n' + block : block
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const range = comingWeekRange(now)
    const weeks = await getFreeSlotsForWeek(range.start, range.end)
    const note = formatFreeSlotsNote(weeks, range, now)

    const todayKey = getNlDateKey(now) // YYYY-MM-DD in NL

    // Alle (nog niet geplaatste) posts van vandaag ophalen en in JS matchen
    // op titel/caption "vrije tijden" of 15:00 NL.
    const todays = await sql<{
      id: number; scheduled_for: string; title: string | null; caption: string | null; internal_notes: string | null
    }>`
      SELECT id, scheduled_for::text, title, caption, internal_notes
      FROM social_posts
      WHERE (scheduled_for AT TIME ZONE 'Europe/Amsterdam')::date = ${todayKey}::date
        AND status NOT IN ('geplaatst', 'posted', 'gemist', 'missed')
      ORDER BY scheduled_for ASC
    `

    const matches = todays.rows.filter(p => {
      const text = `${p.title ?? ''} ${p.caption ?? ''}`.toLowerCase()
      if (text.includes('vrije tijd') || text.includes('vrije tijden')) return true
      const { hour, minute } = getNlHourMinute(p.scheduled_for)
      return hour === 15 && minute === 0
    })

    if (matches.length > 0) {
      for (const p of matches) {
        const updated = applyManagedBlock(p.internal_notes, note)
        await sql`UPDATE social_posts SET internal_notes = ${updated} WHERE id = ${p.id}`
      }
      return NextResponse.json({
        ok: true, action: 'updated', posts: matches.map(p => p.id),
        regions: weeks.length, week: range,
      })
    }

    // Geen passende post gevonden: maak er een aan voor zondag 15:00 NL.
    const scheduledIso = nlLocalToIso(`${todayKey}T15:00`)
    const created = await createSocialPost({
      scheduled_for: scheduledIso,
      platform: 'instagram',
      post_type: 'story',
      category: 'Beschikbaarheid',
      title: 'Komende week vrije tijden',
      status: 'draft',
      internal_notes: applyManagedBlock(null, note),
    })

    return NextResponse.json({
      ok: true, action: 'created', post: created.id,
      regions: weeks.length, week: range,
    })
  } catch (err) {
    console.error('cron/social-free-slots error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
