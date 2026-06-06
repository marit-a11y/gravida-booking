import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Diag-endpoint voor WhatsApp + cron configuratie. Onthult geen secrets,
 * laat alleen zien of de env vars geladen zijn en hoe lang ze zijn.
 */
export async function GET() {
  const checkEnv = (name: string) => {
    const v = process.env[name] ?? ''
    return {
      set: v.length > 0,
      length: v.length,
      first2: v ? v.slice(0, 2) : null,
      last2: v ? v.slice(-2) : null,
    }
  }

  const result: Record<string, unknown> = {
    CRON_SECRET: checkEnv('CRON_SECRET'),
    WHATSAPP_TOKEN: checkEnv('WHATSAPP_TOKEN'),
    WHATSAPP_PHONE_NUMBER_ID: checkEnv('WHATSAPP_PHONE_NUMBER_ID'),
    WHATSAPP_TO: checkEnv('WHATSAPP_TO'),
    WHATSAPP_TEMPLATE_POST_REMINDER: process.env.WHATSAPP_TEMPLATE_POST_REMINDER ?? '(default: gravida_post_reminder)',
  }

  // Probeer de Meta API met de huidige token (alleen GET /me als sanity check)
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const r = await fetch(`https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
        cache: 'no-store',
      })
      const data = await r.json().catch(() => ({}))
      result.meta_api_test = {
        status: r.status,
        ok: r.ok,
        body: data,
      }
    } catch (err) {
      result.meta_api_test = { error: String(err) }
    }
  }

  return NextResponse.json(result)
}
