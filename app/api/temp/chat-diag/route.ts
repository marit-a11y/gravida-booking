import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SETUP_KEY = process.env.SETUP_KEY ?? ''

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token       = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
  const phoneId     = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
  const rawTo       = process.env.WHATSAPP_TO ?? ''
  const lailaNumber = rawTo.split(/[,\n]/)[0].replace(/[^\d]/g, '')

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // 1. Haal WABA ID op via phone number ID
  let wabaId: string | null = null
  let phoneDetails: unknown = null
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}?fields=id,display_phone_number,verified_name,whatsapp_business_account`,
      { headers }
    )
    phoneDetails = await r.json()
    const pd = phoneDetails as Record<string, unknown>
    const waba = pd?.whatsapp_business_account as Record<string, string> | undefined
    wabaId = waba?.id ?? null
  } catch (err) {
    phoneDetails = { fetch_error: String(err) }
  }

  // 2. Lijst templates op in die WABA
  let templates: unknown = null
  if (wabaId) {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=50`,
        { headers }
      )
      templates = await r.json()
    } catch (err) {
      templates = { fetch_error: String(err) }
    }
  }

  // 3. Stuur een echt testbericht naar Laila
  const body = {
    messaging_product: 'whatsapp',
    to: lailaNumber,
    type: 'template',
    template: {
      name: 'gravida_website_chat',
      language: { code: 'nl' },
      components: [{
        type: 'body',
        parameters: [{ type: 'text', text: 'Testbericht van de website' }],
      }],
    },
  }

  let waResult: unknown = null
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    waResult = await res.json()
  } catch (err) {
    waResult = { fetch_error: String(err) }
  }

  return NextResponse.json({
    laila_number:     lailaNumber || '(leeg)',
    phone_number_id:  phoneId ? `${phoneId.slice(0, 6)}...` : '(leeg)',
    token_set:        !!token,
    waba_id:          wabaId,
    phone_details:    phoneDetails,
    available_templates: templates,
    whatsapp_send_result: waResult,
  })
}
