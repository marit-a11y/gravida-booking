import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// GET /api/admin/inbox?recipient=Marit&unread=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient')
    const unreadOnly = searchParams.get('unread') === '1'

    if (!recipient) {
      return NextResponse.json({ error: 'recipient parameter is verplicht' }, { status: 400 })
    }

    const result = unreadOnly
      ? await sql`
          SELECT id, recipient, sender, type, title, body, link, related_task_id,
                 is_read, created_at::text
          FROM inbox_items
          WHERE recipient = ${recipient} AND is_read = false
          ORDER BY created_at DESC
          LIMIT 200
        `
      : await sql`
          SELECT id, recipient, sender, type, title, body, link, related_task_id,
                 is_read, created_at::text
          FROM inbox_items
          WHERE recipient = ${recipient}
          ORDER BY is_read ASC, created_at DESC
          LIMIT 200
        `

    // Unread count
    const countRes = await sql`
      SELECT COUNT(*)::int as count FROM inbox_items
      WHERE recipient = ${recipient} AND is_read = false
    `
    return NextResponse.json({
      items: result.rows,
      unread_count: countRes.rows[0]?.count ?? 0,
    })
  } catch (err) {
    console.error('GET /api/admin/inbox error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: handmatig bericht sturen aan iemand
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipient, sender, title, body: messageBody, link, type } = body

    if (!recipient || !title?.trim()) {
      return NextResponse.json({ error: 'recipient en title zijn verplicht' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO inbox_items (recipient, sender, type, title, body, link)
      VALUES (
        ${recipient},
        ${sender?.trim() || null},
        ${type || 'message'},
        ${title.trim()},
        ${messageBody?.trim() || null},
        ${link?.trim() || null}
      )
      RETURNING id, recipient, sender, type, title, body, link, related_task_id,
                is_read, created_at::text
    `
    return NextResponse.json({ item: result.rows[0] }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Verzenden mislukt: ' + msg }, { status: 500 })
  }
}
