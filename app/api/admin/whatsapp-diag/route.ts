import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GRAPH = 'https://graph.facebook.com/v21.0'

async function graphGet(path: string, token: string) {
  try {
    const res = await fetch(`${GRAPH}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err) } }
  }
}

/**
 * Diagnose voor de WhatsApp-koppeling. Vraagt met het ingestelde token aan
 * Meta of het ingestelde Phone number ID geldig is, welk nummer/naam erbij
 * hoort, en (als bekend) welke nummers er onder de WABA hangen. Zo zien we
 * direct welke Phone number ID bij het huidige token past, zonder in de
 * Meta-UI te hoeven zoeken. Lekt het token niet.
 */
export async function GET() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const pnid = process.env.WHATSAPP_PHONE_NUMBER_ID
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID

  if (!token) {
    return NextResponse.json({ ok: false, reason: 'WHATSAPP_ACCESS_TOKEN ontbreekt in Vercel' })
  }

  const out: Record<string, unknown> = {
    configured: {
      phone_number_id: pnid ?? '(niet gezet)',
      waba_id: wabaId ?? '(niet gezet)',
    },
  }

  // 1. Is het ingestelde Phone number ID bereikbaar met dit token?
  if (pnid) {
    const r = await graphGet(`${pnid}?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status,platform_type`, token)
    out.configuredNumberCheck = r.ok
      ? { ok: true, ...(r.data as object) }
      : { ok: false, status: r.status, error: r.data }
  }

  // 2. Welke nummers hangen er onder de WABA? (als WABA-id bekend is)
  if (wabaId) {
    const r = await graphGet(`${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating`, token)
    out.wabaNumbers = r.ok ? (r.data as object) : { ok: false, status: r.status, error: r.data }
  }

  // 3. Token-info (welke app/scopes) — best effort
  const dbg = await graphGet(`debug_token?input_token=${encodeURIComponent(token)}`, token)
  if (dbg.ok) out.tokenInfo = dbg.data

  return NextResponse.json(out)
}
