import { NextRequest, NextResponse } from 'next/server'
import { getGiftCardByCode } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase()
    const card = await getGiftCardByCode(code)

    if (!card) {
      return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 400 })
    }

    if (card.status !== 'actief') {
      return NextResponse.json({ valid: false, reason: card.status }, { status: 400 })
    }

    // Check expiry
    if (new Date(card.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, reason: 'verlopen' }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      code: card.code,
      type: card.type,
      value_euros: card.value_euros,
      expires_at: card.expires_at,
    })
  } catch (err) {
    console.error('GET /api/gift-cards/[code] error:', err)
    return NextResponse.json({ error: 'Fout bij ophalen cadeaubon' }, { status: 500 })
  }
}
