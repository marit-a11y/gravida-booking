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

  // Stuur een echt testbericht naar Laila
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
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    waResult = await res.json()
  } catch (err) {
    waResult = { fetch_error: String(err) }
  }

  return NextResponse.json({
    laila_number: lailaNumber || '(leeg)',
    phone_number_id: phoneId ? `${phoneId.slice(0, 6)}...` : '(leeg)',
    token_set: !!token,
    whatsapp_response: waResult,
  })
}
