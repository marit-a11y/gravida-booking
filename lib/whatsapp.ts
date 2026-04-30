/**
 * WhatsApp Cloud API helper.
 *
 * Required env vars:
 *  - WHATSAPP_ACCESS_TOKEN     System User token (or temporary user token for testing)
 *  - WHATSAPP_PHONE_NUMBER_ID  The "from" phone number ID (Meta provides one in test mode)
 *  - WHATSAPP_TO               Recipient number, country code without '+', e.g. 31612345678
 *
 * Templates must be pre-approved in Meta Business Manager. We use named templates
 * with body parameters (placeholders). See sendTemplate() for usage.
 *
 * If env vars are missing, all functions silently no-op (so feature can be rolled
 * out before the Meta App is fully configured).
 */

interface WhatsAppTemplateParam {
  type: 'text'
  text: string
}

interface WhatsAppTemplateMessage {
  messaging_product: 'whatsapp'
  to: string
  type: 'template'
  template: {
    name: string
    language: { code: string }
    components: Array<{ type: 'body'; parameters: WhatsAppTemplateParam[] }>
  }
}

export function isWhatsAppConfigured(): boolean {
  return !!(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    process.env.WHATSAPP_TO
  )
}

/**
 * Send a template message via WhatsApp Cloud API.
 * @param templateName  Name of the approved template in Meta Business
 * @param params        Body parameters in order they appear in the template
 * @param language      Language code, default 'nl'
 * @param to            Recipient (defaults to env var)
 */
export async function sendWhatsAppTemplate(
  templateName: string,
  params: string[],
  language = 'nl',
  to?: string,
): Promise<{ ok: boolean; error?: string; response?: unknown }> {
  if (!isWhatsAppConfigured()) {
    console.warn('WhatsApp env vars not set — skipping')
    return { ok: false, error: 'not configured' }
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN!
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const recipient = (to ?? process.env.WHATSAPP_TO!).replace(/[^\d]/g, '')

  const body: WhatsAppTemplateMessage = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [
        {
          type: 'body',
          parameters: params.map(p => ({ type: 'text', text: p })),
        },
      ],
    },
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('WhatsApp send failed:', data)
      return { ok: false, error: JSON.stringify(data), response: data }
    }
    return { ok: true, response: data }
  } catch (err) {
    console.error('WhatsApp send exception:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
