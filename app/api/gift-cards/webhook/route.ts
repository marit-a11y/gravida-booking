import { NextRequest, NextResponse } from 'next/server'
import { activateGiftCard, cancelGiftCard, getGiftCardById } from '@/lib/db'
import { getMollie } from '@/lib/mollie'
import { sendGiftCardEmails } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const params = new URLSearchParams(body)
    const paymentId = params.get('id')

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment id' }, { status: 400 })
    }

    const mollieClient = getMollie()
    const payment = await mollieClient.payments.get(paymentId)
    const metadata = payment.metadata as Record<string, string> | null
    const giftCardId = parseInt(metadata?.gift_card_id ?? '', 10)

    if (!giftCardId) {
      console.error('Webhook: no gift_card_id in payment metadata', paymentId)
      return NextResponse.json({ ok: true })
    }

    if (payment.status === 'paid') {
      const card = await activateGiftCard(giftCardId)
      if (card) {
        await sendGiftCardEmails({
          purchaser_name: card.purchaser_name,
          purchaser_email: card.purchaser_email,
          recipient_name: card.recipient_name,
          recipient_email: card.recipient_email,
          code: card.code,
          type: card.type,
          value_euros: card.value_euros,
          personal_message: card.personal_message,
          expires_at: card.expires_at,
        }).catch(err => console.error('sendGiftCardEmails error:', err))
      }
    } else if (['failed', 'canceled', 'expired'].includes(payment.status)) {
      await cancelGiftCard(giftCardId)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/gift-cards/webhook error:', err)
    return NextResponse.json({ error: 'Webhook verwerking mislukt' }, { status: 500 })
  }
}
