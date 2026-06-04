/**
 * Tijdelijk endpoint om de WhatsApp webhook-abonnement in te stellen via de API.
 * Na gebruik verwijderen.
 *
 * GET  ?key=gravida-setup-2026          → huidige abonnementsstatus opvragen
 * POST ?key=gravida-setup-2026          → webhook registreren + messages subscriben
 */

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SETUP_KEY   = process.env.SETUP_KEY ?? ''
const ACCESS_TOKEN  = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

const CALLBACK_URL  = 'https://gravida-booking.vercel.app/api/webhooks/whatsapp'
const VERIFY_TOKEN  = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? 'gravida-webhook-2026'
const APP_ID        = '1679622143229593'   // Gravida notifications app

async function gf(path: string, method = 'GET', body?: object) {
  const sep = path.includes('?') ? '&' : '?'
  const url = `https://graph.facebook.com/v21.0${path}${sep}access_token=${ACCESS_TOKEN}`
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// GET: controleer huidige webhook-abonnementen
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Ophalen: welke apps zijn geabonneerd op de WABA?
    const wabaR = await gf(`/${PHONE_NUMBER_ID}?fields=whatsapp_business_account`)
    const wabaId = wabaR.data?.whatsapp_business_account?.id

    const subR = wabaId
      ? await gf(`/${wabaId}/subscribed_apps`)
      : { ok: false, data: 'WABA ID niet gevonden' }

    // Ophalen: app-level webhook subscriptions
    const appSubR = await gf(`/${APP_ID}/subscriptions`)

    return NextResponse.json({
      phone_number_id: PHONE_NUMBER_ID,
      waba_id: wabaId,
      waba_subscribed_apps: subR.data,
      app_subscriptions: appSubR.data,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST: registreer webhook en abonneer op messages
export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // Stap 1: haal WABA ID op
    const wabaR = await gf(`/${PHONE_NUMBER_ID}?fields=whatsapp_business_account`)
    const wabaId = wabaR.data?.whatsapp_business_account?.id
    if (!wabaId) {
      return NextResponse.json({ error: 'Kon WABA ID niet ophalen', detail: wabaR.data }, { status: 500 })
    }

    // Stap 2: registreer webhook-URL op app-niveau
    const webhookR = await gf(`/${APP_ID}/subscriptions`, 'POST', {
      object: 'whatsapp_business_account',
      callback_url: CALLBACK_URL,
      verify_token: VERIFY_TOKEN,
      fields: ['messages'],
      access_token: ACCESS_TOKEN,
    })

    // Stap 3: abonneer de app op de WABA
    const subscribeR = await gf(`/${wabaId}/subscribed_apps`, 'POST')

    return NextResponse.json({
      waba_id: wabaId,
      webhook_registration: webhookR.data,
      waba_subscription: subscribeR.data,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
