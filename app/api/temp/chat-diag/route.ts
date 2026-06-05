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

  // 1. /me — wie is dit token?
  let meResult: unknown = null
  try {
    const r = await fetch('https://graph.facebook.com/v21.0/me?fields=id,name', { headers })
    meResult = await r.json()
  } catch (err) { meResult = { fetch_error: String(err) } }

  // 2. Probeer templates op te halen via phone number ID
  let templatesViaPhone: unknown = null
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/message_templates?limit=20`,
      { headers }
    )
    templatesViaPhone = await r.json()
  } catch (err) { templatesViaPhone = { fetch_error: String(err) } }

  // 3. Probeer de template met taalcode 'nl' te sturen (huidige code)
  const sendWith = async (langCode: string) => {
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
            language: { code: langCode },
            components: [{ type: 'body', parameters: [{ type: 'text', text: 'Test' }] }],
          },
        }),
      })
      return await res.json()
    } catch (err) { return { fetch_error: String(err) } }
  }

  const [resultNl, resultEn] = await Promise.all([
    sendWith('nl'),
    sendWith('en_US'),
  ])

  return NextResponse.json({
    laila_number: lailaNumber || '(leeg)',
    phone_number_id: phoneId ? `${phoneId.slice(0, 6)}...` : '(leeg)',
    token_set: !!token,
    me: meResult,
    templates_via_phone: templatesViaPhone,
    send_nl: resultNl,
    send_en_US: resultEn,
  })
}
