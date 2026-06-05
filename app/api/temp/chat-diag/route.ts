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

  const sendTemplate = async (name: string, lang: string, params: string[]) => {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: lailaNumber,
          type: 'template',
          template: {
            name,
            language: { code: lang },
            components: params.length
              ? [{ type: 'body', parameters: params.map(p => ({ type: 'text', text: p })) }]
              : [],
          },
        }),
      })
      const data = await res.json()
      return { ok: res.ok, data }
    } catch (err) {
      return { ok: false, data: { fetch_error: String(err) } }
    }
  }

  // Test beide templates parallel — gravida_post_reminder werkt al voor de social planner
  // Als die ook 132001 geeft weten we dat het aan de token ligt, niet aan de template
  const [resultWebsiteChat, resultPostReminder] = await Promise.all([
    sendTemplate('gravida_website_chat', 'nl', ['Testbericht']),
    // gravida_post_reminder heeft waarschijnlijk 1 of meer params — test zonder params eerst
    sendTemplate('gravida_post_reminder', 'nl', []),
  ])

  // Ook testen met 1 dummy param voor gravida_post_reminder
  const resultPostReminderWithParam = await sendTemplate('gravida_post_reminder', 'nl', ['test'])

  return NextResponse.json({
    laila_number: lailaNumber || '(leeg)',
    phone_number_id: phoneId ? `${phoneId.slice(0, 6)}...` : '(leeg)',
    gravida_website_chat_nl: resultWebsiteChat.data,
    gravida_post_reminder_no_params: resultPostReminder.data,
    gravida_post_reminder_1_param: resultPostReminderWithParam.data,
  })
}
