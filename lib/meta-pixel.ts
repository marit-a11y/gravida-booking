/**
 * Meta Pixel / Conversions API helper
 *
 * Env vars (set in Vercel → Project → Settings → Environment Variables):
 *   NEXT_PUBLIC_META_PIXEL_ID   = 785237213362171   (public, in browser)
 *   META_CAPI_ACCESS_TOKEN      = <lange token>     (server-only, geheim)
 *   META_CAPI_TEST_CODE         = TEST12345          (optioneel, alleen tijdens QA)
 */

import { createHash, randomUUID } from 'crypto'

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '785237213362171'

const GRAPH_API_VERSION = 'v19.0'

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase()
}

export function newEventId(): string {
  return randomUUID()
}

export type CapiUserData = {
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  city?: string
  zip?: string
  country?: string
  /** Voor Bookly-achtige flows: de IP/UA van de klant (kom uit request headers) */
  client_ip_address?: string
  client_user_agent?: string
  /** Meta-cookies uit de browser (_fbp, _fbc) — indien beschikbaar */
  fbp?: string
  fbc?: string
}

export type CapiCustomData = Record<string, unknown>

/**
 * Stuur een event naar Meta Conversions API (server-side).
 *
 * Hash gevoelige velden automatisch. Retourneert true bij succes, false bij fout.
 * Faalt stil (logt enkel) — een falende pixel mag nooit een boeking blokkeren.
 */
export async function sendCapiEvent(params: {
  eventName: string
  eventId: string
  eventSourceUrl?: string
  userData?: CapiUserData
  customData?: CapiCustomData
}): Promise<boolean> {
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!token) {
    // CAPI uitgeschakeld — dat is OK, browser pixel blijft draaien
    return false
  }

  const ud: Record<string, string> = {}
  const u = params.userData ?? {}

  if (u.email)      ud.em = sha256(normalizeText(u.email))
  if (u.phone)      ud.ph = sha256(normalizePhone(u.phone))
  if (u.first_name) ud.fn = sha256(normalizeText(u.first_name))
  if (u.last_name)  ud.ln = sha256(normalizeText(u.last_name))
  if (u.city)       ud.ct = sha256(normalizeText(u.city))
  if (u.zip)        ud.zp = sha256(normalizeText(u.zip).replace(/\s/g, ''))
  if (u.country)    ud.country = sha256(normalizeText(u.country))
  if (u.client_ip_address) ud.client_ip_address = u.client_ip_address
  if (u.client_user_agent) ud.client_user_agent = u.client_user_agent
  if (u.fbp) ud.fbp = u.fbp
  if (u.fbc) ud.fbc = u.fbc

  const payload: Record<string, unknown> = {
    data: [{
      event_name:       params.eventName,
      event_time:       Math.floor(Date.now() / 1000),
      event_id:         params.eventId,
      action_source:    'website',
      event_source_url: params.eventSourceUrl,
      user_data:        ud,
      custom_data:      params.customData ?? {},
    }],
  }

  if (process.env.META_CAPI_TEST_CODE) {
    payload.test_event_code = process.env.META_CAPI_TEST_CODE
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Niet-blokkerend voor de response: gebruik een korte timeout via AbortController
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[meta-capi] ${params.eventName} ${res.status}: ${text}`)
      return false
    }
    return true
  } catch (err) {
    console.error('[meta-capi] network error:', err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Haal IP + user agent + fb-cookies uit een Next.js request (voor CAPI).
 */
export function extractUserDataFromRequest(request: Request): CapiUserData {
  const headers = request.headers
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    undefined
  const ua = headers.get('user-agent') ?? undefined

  const cookieHeader = headers.get('cookie') ?? ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=')
      return [k, v.join('=')]
    }).filter(([k]) => k)
  ) as Record<string, string>

  return {
    client_ip_address: ip,
    client_user_agent: ua,
    fbp: cookies._fbp,
    fbc: cookies._fbc,
  }
}
