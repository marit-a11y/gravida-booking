import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import {
  getAllGiftCards,
  createGiftCard,
  activateGiftCard,
  cancelGiftCard,
  redeemGiftCard,
  getGiftCardById,
} from '@/lib/db'
import { sendGiftCardEmails } from '@/lib/email'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function GET() {
  try {
    if (!(await checkAuth())) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    const giftCards = await getAllGiftCards()
    return NextResponse.json({ giftCards })
  } catch (err) {
    console.error('GET /api/admin/gift-cards error:', err)
    return NextResponse.json({ error: 'Kan cadeaubonnen niet laden' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await checkAuth())) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await request.json()
    const { type, value_euros, purchaser_name, purchaser_email, recipient_name, recipient_email, personal_message } = body

    if (!['digitaal', 'gedrukt', 'usb_box'].includes(type)) {
      return NextResponse.json({ error: 'Ongeldig type cadeaubon' }, { status: 400 })
    }

    const value = typeof value_euros === 'number' ? value_euros : parseFloat(value_euros)
    if (isNaN(value) || value < 1) {
      return NextResponse.json({ error: 'Ongeldig bedrag' }, { status: 400 })
    }

    if (!purchaser_name?.trim() || !recipient_name?.trim() || !purchaser_email?.trim() || !recipient_email?.trim()) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    // Admin creates gift card directly as 'actief' (no payment flow)
    const card = await createGiftCard({
      type,
      value_euros: value,
      purchaser_name: purchaser_name.trim(),
      purchaser_email: purchaser_email.trim().toLowerCase(),
      recipient_name: recipient_name.trim(),
      recipient_email: recipient_email.trim().toLowerCase(),
      personal_message: personal_message?.trim() || undefined,
      status: 'actief',
    })

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

    return NextResponse.json(card, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/gift-cards error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await checkAuth())) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await request.json()
    const { id, action } = body

    if (!id || !action) {
      return NextResponse.json({ error: 'id en action zijn verplicht' }, { status: 400 })
    }

    if (!['redeem', 'cancel', 'activate'].includes(action)) {
      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
    }

    let result = null

    if (action === 'redeem') {
      const card = await getGiftCardById(id)
      if (!card) return NextResponse.json({ error: 'Cadeaubon niet gevonden' }, { status: 404 })
      result = await redeemGiftCard(card.code)
    } else if (action === 'cancel') {
      await cancelGiftCard(id)
      result = await getGiftCardById(id)
    } else if (action === 'activate') {
      result = await activateGiftCard(id)
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('PATCH /api/admin/gift-cards error:', err)
    const msg = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
