import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Generate a default content rotation for an entire month.
 * Pattern is based on the previous content planner spreadsheet:
 *
 * Weekly rhythm (week n in the month):
 * - Maandag       Beeldje story (10:00)
 * - Woensdag      FAQ (3 stories: 10:00, 12:00, 16:00) op week 1, 3
 *                 Review (op week 3)
 *                 Algemeen op week 4
 * - Donderdag     Beeldje story op week 1, 3, 4
 *                 Meet jessica (5 stories) op week 2
 * - Vrijdag       Beeldje story op week 1
 *                 Algemeen op week 3
 * - Zondag        Feedpost (categorie roteert per week) +
 *                 ~5 stories (10:00, 12:00, 14:00, 16:00, 18:00)
 *                 Week 1: Beeldjes  · Week 2: This or that
 *                 Week 3: Bedels    · Week 4: Algemeen
 *
 * Skips dates that already have a post (prevents duplicates).
 */

interface TemplateItem {
  dow: number               // 0=Mon … 6=Sun
  hour: number
  minute: number
  category: string
  post_type: 'feed' | 'story'
  weekIndex?: number[]      // 1-based weeks within month; undefined = every week
  title?: string            // optional placeholder
}

const TEMPLATE: TemplateItem[] = [
  // Maandag — Beeldje story (every week)
  { dow: 0, hour: 10, minute: 0, category: 'Beeldjes', post_type: 'story', title: 'Beeldje story' },

  // Woensdag — varies per week
  { dow: 2, hour: 10, minute: 0, category: 'FAQ',      post_type: 'story', weekIndex: [1, 3], title: 'FAQ vraag 1' },
  { dow: 2, hour: 12, minute: 0, category: 'FAQ',      post_type: 'story', weekIndex: [1, 3], title: 'FAQ vraag 2' },
  { dow: 2, hour: 16, minute: 0, category: 'FAQ',      post_type: 'story', weekIndex: [1, 3], title: 'FAQ vraag 3' },
  { dow: 2, hour: 11, minute: 0, category: 'Beeldjes', post_type: 'story', weekIndex: [2],    title: 'Beeldje story' },
  { dow: 2, hour: 11, minute: 0, category: 'Review',   post_type: 'story', weekIndex: [3],    title: 'Review story' },
  { dow: 2, hour: 11, minute: 0, category: 'Algemeen', post_type: 'feed',  weekIndex: [4],    title: 'Algemeen feedpost' },

  // Donderdag
  { dow: 3, hour: 10, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1, 3, 4], title: 'Beeldje story' },
  { dow: 3, hour: 10, minute: 0, category: 'Meet jessica', post_type: 'story', weekIndex: [2], title: 'Meet Jessica - intro' },
  { dow: 3, hour: 12, minute: 0, category: 'Meet jessica', post_type: 'story', weekIndex: [2], title: 'Meet Jessica - achtergrond' },
  { dow: 3, hour: 14, minute: 0, category: 'Meet jessica', post_type: 'story', weekIndex: [2], title: 'Meet Jessica - werk' },
  { dow: 3, hour: 16, minute: 0, category: 'Meet jessica', post_type: 'story', weekIndex: [2], title: 'Meet Jessica - prive' },
  { dow: 3, hour: 18, minute: 0, category: 'Meet jessica', post_type: 'story', weekIndex: [2], title: 'Meet Jessica - ambities' },

  // Vrijdag
  { dow: 4, hour: 11, minute: 0, category: 'Beeldjes', post_type: 'story', weekIndex: [1], title: 'Beeldje story' },
  { dow: 4, hour: 11, minute: 0, category: 'Algemeen', post_type: 'story', weekIndex: [3], title: 'Algemeen story' },

  // Zondag — feedpost + stories (categorie roteert per week)
  { dow: 6, hour: 11, minute: 0, category: 'Beeldjes',     post_type: 'feed',  weekIndex: [1], title: 'Beeldje feedpost' },
  { dow: 6, hour: 12, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1] },
  { dow: 6, hour: 14, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1] },
  { dow: 6, hour: 16, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1] },
  { dow: 6, hour: 18, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1] },

  { dow: 6, hour: 11, minute: 0, category: 'This or that', post_type: 'story', weekIndex: [2], title: 'This or that #1' },
  { dow: 6, hour: 13, minute: 0, category: 'This or that', post_type: 'story', weekIndex: [2], title: 'This or that #2' },
  { dow: 6, hour: 15, minute: 0, category: 'This or that', post_type: 'story', weekIndex: [2], title: 'This or that #3' },

  { dow: 6, hour: 11, minute: 0, category: 'Bedels',       post_type: 'story', weekIndex: [3], title: 'Bedel story' },
  { dow: 6, hour: 13, minute: 0, category: 'Bedels',       post_type: 'story', weekIndex: [3] },
  { dow: 6, hour: 15, minute: 0, category: 'Bedels',       post_type: 'story', weekIndex: [3] },
  { dow: 6, hour: 17, minute: 0, category: 'Bedels',       post_type: 'story', weekIndex: [3] },

  { dow: 6, hour: 11, minute: 0, category: 'Algemeen',     post_type: 'feed',  weekIndex: [4], title: 'Algemeen feedpost' },
  { dow: 6, hour: 12, minute: 0, category: 'Algemeen',     post_type: 'story', weekIndex: [4] },
  { dow: 6, hour: 14, minute: 0, category: 'Algemeen',     post_type: 'story', weekIndex: [4] },
  { dow: 6, hour: 16, minute: 0, category: 'Algemeen',     post_type: 'story', weekIndex: [4] },
  { dow: 6, hour: 18, minute: 0, category: 'Algemeen',     post_type: 'story', weekIndex: [4] },
]

export async function POST(request: NextRequest) {
  try {
    const { year, month } = await request.json()
    if (typeof year !== 'number' || typeof month !== 'number' || month < 0 || month > 11) {
      return NextResponse.json({ error: 'year (number) en month (0-11) zijn verplicht' }, { status: 400 })
    }

    // Build all dates in this month
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    const dates: Date[] = []
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d))
    }

    // Pre-fetch existing posts in this range to skip duplicate slots
    const fromIso = monthStart.toISOString()
    const toIso = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const existingResult = await sql<{ scheduled_for: string; category: string | null }>`
      SELECT scheduled_for::text, category FROM social_posts
      WHERE scheduled_for >= ${fromIso}::timestamptz AND scheduled_for <= ${toIso}::timestamptz
    `
    const existingKeys = new Set(
      existingResult.rows.map(r => {
        const d = new Date(r.scheduled_for)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}-${r.category ?? ''}`
      })
    )

    let inserted = 0
    for (const date of dates) {
      // Convert to Mon=0 … Sun=6
      const dow = (date.getDay() + 6) % 7
      const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1 // 1 … 5

      const matching = TEMPLATE.filter(t =>
        t.dow === dow && (t.weekIndex === undefined || t.weekIndex.includes(weekOfMonth))
      )
      for (const item of matching) {
        const scheduled = new Date(date)
        scheduled.setHours(item.hour, item.minute, 0, 0)
        const key = `${scheduled.getFullYear()}-${scheduled.getMonth()}-${scheduled.getDate()}-${scheduled.getHours()}-${scheduled.getMinutes()}-${item.category}`
        if (existingKeys.has(key)) continue

        await sql`
          INSERT INTO social_posts (
            scheduled_for, platform, post_type, category, title, image_urls,
            status
          ) VALUES (
            ${scheduled.toISOString()}::timestamptz,
            'instagram',
            ${item.post_type},
            ${item.category},
            ${item.title ?? null},
            '[]'::jsonb,
            'draft'
          )
        `
        inserted++
      }
    }

    return NextResponse.json({ ok: true, inserted })
  } catch (err) {
    console.error('generate-template error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
