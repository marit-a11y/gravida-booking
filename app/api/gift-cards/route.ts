import { NextRequest, NextResponse } from 'next/server'
import { createGiftCard, updateGiftCardMollieId } from '@/lib/db'
import { getMollie } from '@/lib/mollie'

export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  digitaal: 'Digitale cadeaubon',
  gedrukt: 'Gedrukte cadeaubon',
  usb_box: 'USB Cadeaubox',
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, value_euros, purchaser_name, purchaser_email, recipient_name, recipient_email, personal_message } = body

    // Validate type
    if (!['digitaal', 'gedrukt', 'usb_box'].includes(type)) {
      return NextResponse.json({ error: 'Ongeldig type cadeaubon' }, { status: 400 })
    }

    // Validate value
    const value = typeof value_euros === 'number' ? value_euros : parseFloat(value_euros)
    if (isNaN(value) || value < 25 || value > 500) {
      return NextResponse.json({ error: 'Bedrag moet tussen €25 en €500 liggen' }, { status: 400 })
    }

    // Validate required fields
    if (!purchaser_name?.trim() || !recipient_name?.trim()) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    // Validate emails
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(purchaser_email)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres koper' }, { status: 400 })
    }
    if (!emailRe.test(recipient_email)) {
      return NextResponse.json({ error: 'Ongeldig e-mailadres ontvanger' }, { status: 400 })
    }

    // Create gift card record
    const card = await createGiftCard({
      type,
      value_euros: value,
      purchaser_name: purchaser_name.trim(),
      purchaser_email: purchaser_email.trim().toLowerCase(),
      recipient_name: recipient_name.trim(),
      recipient_email: recipient_email.trim().toLowerCase(),
      personal_message: personal_message?.trim() || undefined,
    })

    // Create Mollie payment
    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || ''
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || origin || 'https://gravida-booking.vercel.app'

    if (!process.env.MOLLIE_API_KEY) {
      return NextResponse.json({ error: 'Betalingssysteem niet geconfigureerd. Neem contact op.' }, { status: 500 })
    }

    const mollieClient = getMollie()
    const typeLabel = TYPE_LABELS[type] ?? type
    const payment = await mollieClient.payments.create({
      amount: { currency: 'EUR', value: value.toFixed(2) },
      description: `Gravida cadeaubon \u2014 ${typeLabel} \u00B7 \u20AC${value}`,
      redirectUrl: `${siteUrl}/cadeaubon/bevestiging?gift_card_id=${card.id}`,
      webhookUrl: `${siteUrl}/api/gift-cards/webhook`,
      metadata: { gift_card_id: String(card.id) },
    })

    // Store Mollie payment ID
    await updateGiftCardMollieId(card.id, payment.id)

    return NextResponse.json({ checkoutUrl: payment.getCheckoutUrl() }, { status: 201 })
  } catch (err) {
    console.error('POST /api/gift-cards error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
