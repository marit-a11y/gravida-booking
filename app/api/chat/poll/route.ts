import { NextRequest, NextResponse } from 'next/server'
import { getChatSession } from '@/lib/chat'

export const dynamic = 'force-dynamic'

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() })
}

/**
 * GET /api/chat/poll?session_id=xxx[&after=ISO_TS]
 * Geeft berichten terug die nog niet in de browser zijn.
 * `after` is het tijdstempel van het laatste bekende bericht (ISO 8601).
 */
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('session_id')
    const after = req.nextUrl.searchParams.get('after')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missend session_id' },
        { status: 400, headers: cors() },
      )
    }

    const session = await getChatSession(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Sessie niet gevonden' },
        { status: 404, headers: cors() },
      )
    }

    const messages = after
      ? session.messages.filter(m => m.ts > after)
      : session.messages

    return NextResponse.json({ messages }, { headers: cors() })
  } catch (err) {
    console.error('chat/poll error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: cors() })
  }
}
