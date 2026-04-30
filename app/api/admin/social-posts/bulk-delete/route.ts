import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// Bulk delete: verwijder posts in een datumbereik, optioneel gefilterd op status.
// Voor "wis maand X" of "wis alle concepten in maand X".
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from, to, status, only_empty } = body as {
      from?: string
      to?: string
      status?: string  // 'draft' | 'klaargezet' | 'geplaatst' | 'gemist' | 'all'
      only_empty?: boolean  // alleen posts zonder titel/caption/media
    }

    if (!from || !to) {
      return NextResponse.json({ error: 'from en to (ISO datums) zijn verplicht' }, { status: 400 })
    }

    // "Leeg" = geen caption EN geen media. Titel telt NIET mee, want
    // de generate-template zet placeholder-titels (bv. "Reel: beeldjes
    // proces") en die wil je juist mee opruimen.
    let result
    if (status && status !== 'all' && only_empty) {
      result = await sql`
        DELETE FROM social_posts
        WHERE scheduled_for >= ${from}
          AND scheduled_for <= ${to}
          AND status = ${status}
          AND (caption IS NULL OR caption = '')
          AND (image_urls IS NULL OR image_urls::text = '[]' OR image_urls::text = 'null' OR jsonb_array_length(image_urls) = 0)
      `
    } else if (status && status !== 'all') {
      result = await sql`
        DELETE FROM social_posts
        WHERE scheduled_for >= ${from}
          AND scheduled_for <= ${to}
          AND status = ${status}
      `
    } else if (only_empty) {
      result = await sql`
        DELETE FROM social_posts
        WHERE scheduled_for >= ${from}
          AND scheduled_for <= ${to}
          AND (caption IS NULL OR caption = '')
          AND (image_urls IS NULL OR image_urls::text = '[]' OR image_urls::text = 'null' OR jsonb_array_length(image_urls) = 0)
      `
    } else {
      result = await sql`
        DELETE FROM social_posts
        WHERE scheduled_for >= ${from}
          AND scheduled_for <= ${to}
      `
    }

    return NextResponse.json({ deleted: result.rowCount ?? 0 })
  } catch (err) {
    console.error('POST /api/admin/social-posts/bulk-delete error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verwijderen mislukt: ' + msg }, { status: 500 })
  }
}
