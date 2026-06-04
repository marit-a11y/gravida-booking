/**
 * WhatsApp Cloud API helper.
 *
 * Required env vars:
 *  - WHATSAPP_ACCESS_TOKEN     System User token (or temporary user token for testing)
 *  - WHATSAPP_PHONE_NUMBER_ID  The "from" phone number ID (Meta provides one in test mode)
 *  - WHATSAPP_TO               Recipient number(s), country code without '+'.
 *                              Single: 31612345678
 *                              Multiple (komma-gescheiden): 31612345678,31698765432
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

/**
 * Stuur een vrije-tekst (non-template) WhatsApp-bericht.
 * Werkt alleen binnen een open 24-uurs conversatievenster.
 * Gebruikt alleen het eerste nummer in WHATSAPP_TO (of het meegegeven `to`).
 */
export async function sendWhatsAppText(
  text: string,
  to?: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const rawTo = to ?? process.env.WHATSAPP_TO
  if (!token || !phoneNumberId || !rawTo) {
    return { ok: false, error: 'not configured' }
  }
  const recipient = rawTo.split(/[,\n]/)[0].replace(/[^\d]/g, '')
  if (!recipient) return { ok: false, error: 'No valid recipient' }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body: text, preview_url: false },
        }),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('WhatsApp text send failed:', data)
      return { ok: false, error: JSON.stringify(data) }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
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
 * @param to            Recipient (defaults to env var). Mag komma-gescheiden zijn.
 * @param buttonParam   Optional: dynamic URL parameter voor de eerste URL-button.
 *                      Wordt alleen meegestuurd als `WHATSAPP_DYNAMIC_BUTTON=true`,
 *                      anders genegeerd (zodat statische URL-templates blijven werken).
 */
export async function sendWhatsAppTemplate(
  templateName: string,
  params: string[],
  language = 'nl',
  to?: string,
  buttonParam?: string,
): Promise<{ ok: boolean; error?: string; response?: unknown; results?: Array<{ to: string; ok: boolean; error?: string }> }> {
  if (!isWhatsAppConfigured()) {
    console.warn('WhatsApp env vars not set — skipping')
    return { ok: false, error: 'not configured' }
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN!
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!
  const raw = (to ?? process.env.WHATSAPP_TO!)
  // Splits op komma of nieuwe regel; strip alle niet-cijfers per nummer
  const recipients = raw
    .split(/[,\n]/)
    .map(s => s.replace(/[^\d]/g, ''))
    .filter(Boolean)

  if (recipients.length === 0) {
    return { ok: false, error: 'Geen geldige recipient(s) in WHATSAPP_TO' }
  }

  const useDynamicButton = process.env.WHATSAPP_DYNAMIC_BUTTON === 'true'

  const sendOne = async (recipient: string) => {
    const components: Array<Record<string, unknown>> = [
      {
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: p })),
      },
    ]
    if (useDynamicButton && buttonParam) {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: buttonParam }],
      })
    }

    const body = {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components,
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
        console.error(`WhatsApp send failed to ${recipient}:`, data)
        return { to: recipient, ok: false, error: JSON.stringify(data), data }
      }
      return { to: recipient, ok: true, data }
    } catch (err) {
      return { to: recipient, ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  const results = await Promise.all(recipients.map(sendOne))
  const allOk = results.every(r => r.ok)
  const firstError = results.find(r => !r.ok)?.error

  return {
    ok: allOk,
    error: allOk ? undefined : firstError,
    response: results,
    results: results.map(r => ({ to: r.to, ok: r.ok, error: r.error })),
  }
}
