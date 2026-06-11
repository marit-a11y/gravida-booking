import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// GET: alle scanweek-aanmeldingen (native) + legacy (gravida-new proxy)
export async function GET() {
  try {
    const r = await sql`
      SELECT id, email, name, current_week, signup_week_date::text, region, status, note,
             confirm_sent_at::text, reminder_sent_at::text, created_at::text
      FROM scanweek_signups
      ORDER BY created_at DESC
    `
    const native = r.rows
    const nativeEmails = new Set(native.map(x => String(x.email).toLowerCase()))

    // Legacy: oude aanmeldingen die nog op gravida-new staan (overgangsperiode).
    // We tonen ze erbij zodat niets uit het zicht verdwijnt voordat het
    // website-formulier naar dit dashboard post.
    let legacy: unknown[] = []
    const SITE_URL = process.env.GRAVIDA_SITE_URL ?? 'https://gravida-new.vercel.app'
    const SECRET = process.env.GRAVIDA_SITE_SECRET ?? ''
    if (SECRET) {
      try {
        const res = await fetch(`${SITE_URL}/api/admin/scanweek-submissions?secret=${encodeURIComponent(SECRET)}`, { cache: 'no-store' })
        if (res.ok) {
          const d = await res.json().catch(() => ({}))
          const subs = Array.isArray(d?.submissions) ? d.submissions : []
          legacy = subs
            .filter((s: { email?: string }) => !nativeEmails.has(String(s.email ?? '').toLowerCase()))
            .map((s: { id?: string; email?: string; name?: string; due_date?: string; status?: string; timestamp?: string }) => ({
              id: `legacy-${s.id}`,
              email: s.email ?? '',
              name: s.name ?? null,
              current_week: null,            // oude data had geen huidige week
              signup_week_date: (s.timestamp ?? '').slice(0, 10) || null,
              region: null,
              status: s.status === 'approved' || s.status === 'booked' ? 'booked'
                    : s.status === 'rejected' || s.status === 'dismissed' ? 'dismissed'
                    : s.status === 'contacted' ? 'contacted' : 'pending',
              note: 'Oude aanmelding (gravida-new)',
              confirm_sent_at: null,
              reminder_sent_at: null,
              created_at: s.timestamp ?? null,
              legacy: true,
            }))
        }
      } catch { /* proxy niet bereikbaar — toon alleen native */ }
    }

    return NextResponse.json({ signups: [...native, ...legacy] })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// PATCH: status / notitie bijwerken
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, status, note } = body
    if (!id) return NextResponse.json({ error: 'id verplicht' }, { status: 400 })
    if (status && !['pending', 'contacted', 'booked', 'dismissed'].includes(status)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
    }
    await sql`
      UPDATE scanweek_signups
      SET status = COALESCE(${status ?? null}, status),
          note = COALESCE(${note ?? null}, note),
          updated_at = NOW()
      WHERE id = ${parseInt(String(id), 10)}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
