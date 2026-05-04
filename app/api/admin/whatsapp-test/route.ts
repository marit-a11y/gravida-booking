import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppTemplate, isWhatsAppConfigured } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// GET: status van WhatsApp config (zonder secrets te lekken)
export async function GET() {
  return NextResponse.json({
    configured: isWhatsAppConfigured(),
    env: {
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ? '✓ ingesteld' : '✗ ontbreekt',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID
        ? `✓ ${process.env.WHATSAPP_PHONE_NUMBER_ID.slice(0, 6)}...${process.env.WHATSAPP_PHONE_NUMBER_ID.slice(-4)}`
        : '✗ ontbreekt',
      WHATSAPP_TO: process.env.WHATSAPP_TO
        ? `✓ ${process.env.WHATSAPP_TO.slice(0, 4)}...${process.env.WHATSAPP_TO.slice(-3)}`
        : '✗ ontbreekt',
      WHATSAPP_TEMPLATE_CONTENT_MISSING: process.env.WHATSAPP_TEMPLATE_CONTENT_MISSING ?? '(default: gravida_content_missing)',
      WHATSAPP_TEMPLATE_POST_REMINDER: process.env.WHATSAPP_TEMPLATE_POST_REMINDER ?? '(default: gravida_post_reminder)',
    },
  })
}

// POST: stuur een test-bericht
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      template = 'reminder',  // 'reminder' | 'content_missing' | 'hello_world'
      to,                     // optional override
    } = body

    let templateName: string
    let params: string[]
    let language = 'nl'

    if (template === 'content_missing') {
      templateName = process.env.WHATSAPP_TEMPLATE_CONTENT_MISSING ?? 'gravida_content_missing'
      params = ['20:00', 'Test categorie', 'reel']
    } else if (template === 'hello_world') {
      templateName = 'hello_world'
      params = []
      language = 'en_US'
    } else {
      templateName = process.env.WHATSAPP_TEMPLATE_POST_REMINDER ?? 'gravida_post_reminder'
      params = ['Test post (handmatige check)', '20:00', 'feed']
    }

    const result = await sendWhatsAppTemplate(templateName, params, language, to)
    return NextResponse.json({
      ok: result.ok,
      template: templateName,
      params,
      to: to ?? process.env.WHATSAPP_TO ?? '(niet gezet)',
      error: result.error,
      response: result.response,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
