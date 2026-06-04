/**
 * WhatsApp Cloud API webhook.
 *
 * GET  — verificatie door Meta (hub.challenge)
 * POST — inkomende berichten van Laila, gekoppeld aan de actieve chat-sessie
 *
 * Env vars:
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN  Token dat Meta terugstuurt tijdens verificatie.
 *                                  Stel dit ook in als Callback Token in Meta Business.
 *   WHATSAPP_TO                    Laila's nummer (eerste in de lijst) — zo herkennen
 *                                  we haar antwoord in de webhook-payload.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLatestActiveSession, addLailaReply } from '@/lib/chat'

export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? ''

// Laila's persoonlijk WhatsApp-nummer (cijfers, geen +)
const LAILA_NUMBER = (process.env.WHATSAPP_TO ?? '')
  .split(/[,\n]/)[0]
  .replace(/[^\d]/g, '')

// GET: Meta verificatie
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const mode = p.get('hub.mode')
  const token = p.get('hub.verify_token')
  const challenge = p.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST: inkomende berichten
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      // Bezorg-ontvangstbewijzen of statusupdates — negeren
      return NextResponse.json({ ok: true })
    }

    for (const msg of messages) {
      // Alleen tekstberichten verwerken
      if (msg.type !== 'text') continue
      const from: string = (msg.from ?? '').replace(/[^\d]/g, '')
      const text: string = msg.text?.body ?? ''
      if (!text || !from) continue

      // Alleen verwerken als het van Laila's nummer komt
      if (from !== LAILA_NUMBER) continue

      // Koppel aan de meest recente actieve sessie
      const session = await getLatestActiveSession()
      if (!session) {
        console.log('WhatsApp webhook: antwoord van Laila maar geen actieve sessie')
        continue
      }

      await addLailaReply(session.id, text)
      console.log(`WhatsApp webhook: antwoord van Laila opgeslagen in sessie ${session.id}`)
    }

    // Altijd 200 terugsturen aan Meta, anders herprobeert Meta de levering
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('whatsapp webhook error:', err)
    return NextResponse.json({ ok: true }) // ook bij fouten 200 teruggeven
  }
}
