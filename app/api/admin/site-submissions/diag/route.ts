import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Diagnose endpoint — laat zien wat onze proxy ziet zonder de secret te onthullen.
 * Geeft terug:
 *  - of de secret is ingesteld + lengte + eerste/laatste teken (voor mismatch-check)
 *  - welke URL we aanroepen
 *  - status + body van gravida-new
 */
export async function GET() {
  const SITE_URL = process.env.GRAVIDA_SITE_URL ?? 'https://gravida-new-o7di.vercel.app'
  const SECRET = process.env.GRAVIDA_SITE_SECRET ?? ''

  const secretInfo = SECRET ? {
    set: true,
    length: SECRET.length,
    firstChar: SECRET.charAt(0),
    lastChar: SECRET.charAt(SECRET.length - 1),
    hasTrailingWhitespace: /\s$/.test(SECRET),
    hasLeadingWhitespace: /^\s/.test(SECRET),
  } : { set: false }

  if (!SECRET) {
    return NextResponse.json({ site_url: SITE_URL, secret: secretInfo })
  }

  const targetUrl = `${SITE_URL}/api/admin/submissions?secret=${encodeURIComponent(SECRET)}`
  let upstream: Record<string, unknown> = {}
  try {
    const r = await fetch(targetUrl, { cache: 'no-store' })
    const text = await r.text()
    let parsed: unknown = null
    try { parsed = JSON.parse(text) } catch { /* ignore */ }
    upstream = {
      status: r.status,
      ok: r.ok,
      body_preview: text.slice(0, 300),
      body_parsed: parsed,
    }
  } catch (err) {
    upstream = { fetch_error: String(err) }
  }

  return NextResponse.json({
    site_url: SITE_URL,
    target_url_without_secret: `${SITE_URL}/api/admin/submissions?secret=***`,
    secret: secretInfo,
    upstream,
  })
}
