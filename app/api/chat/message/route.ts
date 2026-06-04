import { NextRequest, NextResponse } from 'next/server'
import { getChatSession, addVisitorMessage, markLailaNotified, isWindowOpen } from '@/lib/chat'
import { sendWhatsAppTemplate, sendWhatsAppText } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

// Sjabloon aan te maken in Meta Business:
//   Naam: gravida_website_chat
//   Categorie: UTILITY
//   Taal: Dutch (nl)
//   Body: Nieuwe vraag via de website:\n\n"{{1}}"\n\nAntwoord hier om terug te sturen aan de bezoeker.
const CHAT_TEMPLATE = process.env.WHATSAPP_TEMPLATE_WEBSITE_CHAT ?? 'gravida_website_chat'

// Laila's nummer: eerste waarde uit WHATSAPP_TO
const LAILA_NUMBER = (process.env.WHATSAPP_TO ?? '').split(/[,\n]/)[0].replace(/[^\d]/g, '')

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
