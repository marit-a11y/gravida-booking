import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { giftCardPurchaserEmailHtmlPreview, giftCardRecipientEmailHtmlPreview } from '@/lib/email'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth())) {
    return new NextResponse('Niet geautoriseerd', { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const role = searchParams.get('role') ?? 'recipient'

  const sample = {
    purchaser_name: 'Lisa de Vries',
    purchaser_email: 'lisa@example.nl',
    recipient_name: 'Emma Jansen',
    recipient_email: 'emma@example.nl',
    code: 'GRAVI-A3K7-X2NP',
    type: 'digitaal',
    value_euros: 75,
    personal_message: 'Gefeliciteerd met je zwangerschap! Ik hoop dat je hier heel veel plezier van hebt. 🤍',
    expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  }

  const html = role === 'purchaser'
    ? giftCardPurchaserEmailHtmlPreview(sample)
    : giftCardRecipientEmailHtmlPreview({ ...sample, redeem_url: 'https://www.gravida.nl/boeken/' })

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
