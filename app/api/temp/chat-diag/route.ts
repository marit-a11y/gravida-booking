import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SETUP_KEY = process.env.SETUP_KEY ?? ''

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('key') !== SETUP_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token   = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
  const rawTo   = process.env.WHATSAPP_TO ?? ''
  const lailaNumber = rawTo.split(/[,\n]/)[0].replace(/[^\d]/g, '')

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  // ID van /me — test of dit het WABA ID is
  const ME_ID = '122106029919300091'

  // 1. Probeer templates op te halen via ME_ID (alsof het een WABA is)
  let templatesViaMeId: unknown = null
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${ME_ID}/message_templates?limit=30&fields=name,language,status`,
      { headers }
    )
    templatesViaMeId = await r.json()
  } catch (err) { templatesViaMeId = { fetch_error: String(err) } }

  // 2. Probeer /me/businesses
  let businesses: unknown = null
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?fields=id,name`,
      { headers }
    )
    businesses = await r.json()
  } catch (err) { businesses = { fetch_error: String(err) } }

  // 3. Probeer /me/whatsapp_business_accounts
  let wabaAccounts: unknown = null
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name`,
      { headers }
    )
    wabaAccounts = await r.json()
  } catch (err) { wabaAccounts = { fetch_error: String(err) } }

  // 4. Stuur test met nl (verwacht 132001)
  let sendNl: unknown = null
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: lailaNumber,
        type: 'template',
        template: {
          name: 'gravida_website_chat',
          language: { code: 'nl' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: 'Test' }] }],
        },
      }),
    })
    sendNl = await res.json()
  } catch (err) { sendNl = { fetch_error: String(err) } }

  return NextResponse.json({
    laila_number: lailaNumber || '(leeg)',
    phone_number_id: phoneId ? `${phoneId.slice(0, 6)}...` : '(leeg)',
    me_id: ME_ID,
    templates_via_me_id: templatesViaMeId,
    businesses,
    waba_accounts: wabaAccounts,
    send_nl: sendNl,
  })
}
