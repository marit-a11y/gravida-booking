import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Generate an algorithm-optimised content rotation for the entire month.
 *
 * Per week (based on 2026 IG algorithm best practices):
 * - 3 Reels    (recommended 4-7/week — kies 3 om haalbaar te houden)
 * - 2 Feedposts (recommended 2-3/week wanneer ook Reels)
 * - 14 Stories (recommended 2/dag gemiddeld)
 *
 * Content mix volgt 3:2:1 regel — educatief / entertainment / promotie.
 * Tijden afgestemd op data-driven IG peak hours (Wed 12:00, Thu 9:00,
 * Reels 18:00-23:00 weekdagen).
 *
 * Categorieën roteren per week zodat de feed niet repetitief is:
 *   Week 1: Beeldjes-focus      (educatief over producten)
 *   Week 2: Atelier             (entertainment / persoonlijk, achter-de-schermen)
 *   Week 3: Bedels + Review     (variatie + social proof)
 *   Week 4: Algemeen / promo    (boekingen, scannen, info)
 */

interface TemplateItem {
  dow: number              // 0=Mon … 6=Sun
  hour: number
  minute: number
  category: string
  post_type: 'feed' | 'story' | 'reel'
  weekIndex?: number[]     // 1-based weeks within month
  title?: string
}

const TEMPLATE: TemplateItem[] = [
  // ──────────────────────── MAANDAG ────────────────────────
  // Reel om 19:00 (peak time) — categorie roteert per week
  { dow: 0, hour: 19, minute: 0, category: 'Beeldjes',     post_type: 'reel',  weekIndex: [1], title: 'Reel: beeldjes proces' },
  { dow: 0, hour: 19, minute: 0, category: 'Atelier', post_type: 'reel',  weekIndex: [2], title: 'Reel: atelier sneak peek'},
  { dow: 0, hour: 19, minute: 0, category: 'Bedels',       post_type: 'reel',  weekIndex: [3], title: 'Reel: bedels' },
  { dow: 0, hour: 19, minute: 0, category: 'Algemeen',     post_type: 'reel',  weekIndex: [4], title: 'Reel: scan ervaring' },
  // Stories
  { dow: 0, hour: 10, minute: 0, category: 'Beeldjes',     post_type: 'story' },
  { dow: 0, hour: 17, minute: 0, category: 'Beeldjes',     post_type: 'story' },

  // ──────────────────────── DINSDAG ────────────────────────
  { dow: 1, hour: 10, minute: 0, category: 'This or that', post_type: 'story', weekIndex: [1, 3], title: 'This or that' },
  { dow: 1, hour: 10, minute: 0, category: 'Atelier', post_type: 'story', weekIndex: [2], title: 'Achter de schermen' },
  { dow: 1, hour: 10, minute: 0, category: 'Review',       post_type: 'story', weekIndex: [4], title: 'Review highlight' },
  { dow: 1, hour: 17, minute: 0, category: 'Beeldjes',     post_type: 'story' },

  // ──────────────────────── WOENSDAG ────────────────────────
  // Feedpost om 12:00 (peak time)
  { dow: 2, hour: 12, minute: 0, category: 'FAQ',      post_type: 'feed',  weekIndex: [1], title: 'FAQ carousel: 3D scan basics' },
  { dow: 2, hour: 12, minute: 0, category: 'Beeldjes', post_type: 'feed',  weekIndex: [2], title: 'Beeldje feedpost' },
  { dow: 2, hour: 12, minute: 0, category: 'Bedels',   post_type: 'feed',  weekIndex: [3], title: 'Bedels feedpost' },
  { dow: 2, hour: 12, minute: 0, category: 'Algemeen', post_type: 'feed',  weekIndex: [4], title: 'Boek nu / aanbieding' },
  // Stories ondersteunend
  { dow: 2, hour: 10, minute: 0, category: 'FAQ',      post_type: 'story', weekIndex: [1] },
  { dow: 2, hour: 10, minute: 0, category: 'Beeldjes', post_type: 'story', weekIndex: [2, 3, 4] },
  { dow: 2, hour: 18, minute: 0, category: 'Beeldjes', post_type: 'story' },

  // ──────────────────────── DONDERDAG ────────────────────────
  // Reel om 19:00 — categorie roteert
  { dow: 3, hour: 19, minute: 0, category: 'FAQ',          post_type: 'reel', weekIndex: [1], title: 'Reel: veelgestelde vraag' },
  { dow: 3, hour: 19, minute: 0, category: 'Atelier', post_type: 'reel', weekIndex: [2], title: 'Reel: atelier proces'},
  { dow: 3, hour: 19, minute: 0, category: 'Review',       post_type: 'reel', weekIndex: [3], title: 'Reel: klant ervaring' },
  { dow: 3, hour: 19, minute: 0, category: 'This or that', post_type: 'reel', weekIndex: [4], title: 'Reel: this or that' },
  // Stories
  { dow: 3, hour: 10, minute: 0, category: 'Beeldjes', post_type: 'story' },
  { dow: 3, hour: 17, minute: 0, category: 'Bedels',   post_type: 'story', weekIndex: [3], title: 'Bedel close-up' },
  { dow: 3, hour: 17, minute: 0, category: 'Beeldjes', post_type: 'story', weekIndex: [1, 2, 4] },

  // ──────────────────────── VRIJDAG ────────────────────────
  { dow: 4, hour: 10, minute: 0, category: 'Algemeen', post_type: 'story', title: 'Weekend boekingstip' },
  { dow: 4, hour: 17, minute: 0, category: 'Beeldjes', post_type: 'story' },

  // ──────────────────────── ZATERDAG ────────────────────────
  // Reel om 19:00 (zaterdagavond peak)
  { dow: 5, hour: 19, minute: 0, category: 'Beeldjes',     post_type: 'reel',  weekIndex: [1, 4], title: 'Reel: beeldje highlight' },
  { dow: 5, hour: 19, minute: 0, category: 'This or that', post_type: 'reel',  weekIndex: [2], title: 'Reel: this or that' },
  { dow: 5, hour: 19, minute: 0, category: 'Bedels',       post_type: 'reel',  weekIndex: [3], title: 'Reel: bedels in het wild' },
  { dow: 5, hour: 12, minute: 0, category: 'Beeldjes',     post_type: 'story' },

  // ──────────────────────── ZONDAG ────────────────────────
  // Feedpost om 11:00 — categorie roteert per week
  { dow: 6, hour: 11, minute: 0, category: 'Beeldjes',     post_type: 'feed', weekIndex: [1], title: 'Beeldje feedpost' },
  { dow: 6, hour: 11, minute: 0, category: 'Atelier', post_type: 'feed', weekIndex: [2], title: 'Atelier feedpost'},
  { dow: 6, hour: 11, minute: 0, category: 'Review',       post_type: 'feed', weekIndex: [3], title: 'Review feedpost' },
  { dow: 6, hour: 11, minute: 0, category: 'Algemeen',     post_type: 'feed', weekIndex: [4], title: 'Algemeen feedpost' },
  // Ondersteunende stories
  { dow: 6, hour: 13, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1] },
  { dow: 6, hour: 16, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1] },
  { dow: 6, hour: 19, minute: 0, category: 'Beeldjes',     post_type: 'story', weekIndex: [1] },
  { dow: 6, hour: 13, minute: 0, category: 'This or that', post_type: 'story', weekIndex: [2] },
  { dow: 6, hour: 16, minute: 0, category: 'Atelier', post_type: 'story', weekIndex: [2] },
  { dow: 6, hour: 19, minute: 0, category: 'Atelier', post_type: 'story', weekIndex: [2] },
  { dow: 6, hour: 13, minute: 0, category: 'Bedels',       post_type: 'story', weekIndex: [3] },
  { dow: 6, hour: 16, minute: 0, category: 'Review',       post_type: 'story', weekIndex: [3] },
  { dow: 6, hour: 19, minute: 0, category: 'Bedels',       post_type: 'story', weekIndex: [3] },
  { dow: 6, hour: 13, minute: 0, category: 'Algemeen',     post_type: 'story', weekIndex: [4] },
  { dow: 6, hour: 16, minute: 0, category: 'Algemeen',     post_type: 'story', weekIndex: [4] },
  { dow: 6, hour: 19, minute: 0, category: 'Algemeen',     post_type: 'story', weekIndex: [4] },
]

export async function POST(request: NextRequest) {
  try {
    const { year, month } = await request.json()
    if (typeof year !== 'number' || typeof month !== 'number' || month < 0 || month > 11) {
      return NextResponse.json({ error: 'year (number) en month (0-11) zijn verplicht' }, { status: 400 })
    }

    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    const dates: Date[] = []
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d))
    }

    const fromIso = monthStart.toISOString()
    const toIso = new Date(year, month + 1, 0, 23, 59, 59).toISOString()
    const existingResult = await sql<{ scheduled_for: string; category: string | null; post_type: string }>`
      SELECT scheduled_for::text, category, post_type FROM social_posts
      WHERE scheduled_for >= ${fromIso}::timestamptz AND scheduled_for <= ${toIso}::timestamptz
    `
    // Skip an exact (date, hour, minute, category, post_type) combination if already there
    const existingKeys = new Set(
      existingResult.rows.map(r => {
        const d = new Date(r.scheduled_for)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}-${r.category ?? ''}-${r.post_type}`
      })
    )

    let inserted = 0
    for (const date of dates) {
      const dow = (date.getDay() + 6) % 7
      const weekOfMonth = Math.floor((date.getDate() - 1) / 7) + 1

      const matching = TEMPLATE.filter(t =>
        t.dow === dow && (t.weekIndex === undefined || t.weekIndex.includes(weekOfMonth))
      )
      for (const item of matching) {
        const scheduled = new Date(date)
        scheduled.setHours(item.hour, item.minute, 0, 0)
        const key = `${scheduled.getFullYear()}-${scheduled.getMonth()}-${scheduled.getDate()}-${scheduled.getHours()}-${scheduled.getMinutes()}-${item.category}-${item.post_type}`
        if (existingKeys.has(key)) continue

        await sql`
          INSERT INTO social_posts (
            scheduled_for, platform, post_type, category, title, image_urls, status
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
