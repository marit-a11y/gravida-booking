import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getChatSession, addVisitorMessage, markLailaNotified, isWindowOpen } from '@/lib/chat'
import { sendWhatsAppTemplate, sendWhatsAppText } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// Sjabloon aan te maken in Meta Business (WABA die bij het telefoonnummer hoort):
//   Naam: gravida_website_chat
//   Categorie: Marketing
//   Taal: Dutch (nl)
//   Body: Nieuwe vraag via de website:\n\n"{{1}}"\n\nAntwoord hier om terug te sturen aan de bezoeker.
const CHAT_TEMPLATE = process.env.WHATSAPP_TEMPLATE_WEBSITE_CHAT ?? 'gravida_website_chat'

// Laila's nummer: eerste waarde uit WHATSAPP_TO
const LAILA_NUMBER = (process.env.WHATSAPP_TO ?? '').split(/[,\n]/)[0].replace(/[^\d]/g, '')

// E-mail fallback: als WhatsApp template (nog) niet werkt
const NOTIFICATION_EMAIL = process.env.CHAT_NOTIFICATION_EMAIL ?? 'hi@gravida.nl'
const FROM_EMAIL = (process.env.EMAIL_FROM ?? 'Gravida <hi@gravida.nl>').trim()

async function sendEmailFallback(visitorText: string): Promise<void> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFICATION_EMAIL,
      subject: 'Nieuw chatbericht via de website',
      html: `
        <p>Er is een nieuw bericht binnengekomen via de chat op gravida.nl:</p>
        <blockquote style="border-left:3px solid #3d5c41;padding-left:12px;color:#333;">
          ${visitorText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </blockquote>
        <p>Log in op het dashboard om te reageren, of open WhatsApp zodra de template beschikbaar is.</p>
      `,
    })
  } catch (err) {
    console.warn('Email fallback failed:', err)
  }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors() })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { session_id, text } = body as { session_id?: string; text?: string }

    if (!session_id || !text?.trim()) {
      return NextResponse.json(
        { error: 'session_id en text zijn verplicht' },
        { status: 400, headers: cors() },
      )
    }

    const trimmed = text.trim()

    const session = await getChatSession(session_id)
    if (!session) {
      return NextResponse.json(
        { error: 'Sessie niet gevonden' },
        { status: 404, headers: cors() },
      )
    }

    // Sla het bericht op
    const updated = await addVisitorMessage(session_id, trimmed)

    // Notificeer Laila via WhatsApp
    if (!session.laila_notified) {
      // Eerste bericht: gebruik template om het gesprek te openen
      const truncated = trimmed.length > 900 ? trimmed.slice(0, 897) + '...' : trimmed
      const result = await sendWhatsAppTemplate(CHAT_TEMPLATE, [truncated], 'nl', LAILA_NUMBER)
      if (result.ok) {
        await markLailaNotified(session_id)
      } else {
        console.warn('WhatsApp template send failed:', result.error)
        // Fallback: stuur e-mail zodat Laila het bericht toch ontvangt
        await sendEmailFallback(trimmed)
      }
    } else if (isWindowOpen(session)) {
      // Vervolg-bericht binnen het 24-uurs venster: stuur als vrije tekst
      await sendWhatsAppText(`Bezoeker: ${trimmed}`, LAILA_NUMBER)
    }
    // Als Laila al genotificeerd is maar het venster gesloten is, wordt het bericht
    // opgeslagen maar niet doorgestuurd totdat Laila opnieuw reageert.

    return NextResponse.json(
      { ok: true, messages: updated?.messages ?? [] },
      { headers: cors() },
    )
  } catch (err) {
    console.error('chat/message error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500, headers: cors() })
  }
}
