import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

const GIFTUP_API_KEY = process.env.GIFTUP_API_KEY ?? ''
const GIFTUP_BASE    = 'https://api.giftup.app'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

type GiftUpCard = {
  code: string
  recipientName: string
  recipientEmail: string
  purchaserName: string
  message: string
  initialValue: number
  remainingValue: number
  fulfilledBy: string | null
  canBeRedeemed: boolean
  isVoided: boolean
  hasExpired: boolean
  expiresOn: string | null
  createdOn: string
  emailFulfilment: { emailAddress: string } | null
}

function mapType(fulfilledBy: string | null): string {
  if (fulfilledBy === 'Email') return 'digitaal'
  if (fulfilledBy === 'Print' || fulfilledBy === 'Post') return 'gedrukt'
  return 'digitaal'
}

function mapStatus(card: GiftUpCard): string {
  if (card.isVoided) return 'geannuleerd'
  if (card.hasExpired) return 'verlopen'
  if (card.canBeRedeemed) return 'actief'
  return 'actief'
}

async function fetchAllGiftUpCards(): Promise<GiftUpCard[]> {
  const all: GiftUpCard[] = []
  let skip = 0
  const take = 100

  while (true) {
    const res = await fetch(`${GIFTUP_BASE}/gift-cards?take=${take}&skip=${skip}`, {
      headers: {
        Authorization: `Bearer ${GIFTUP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`GiftUp API error: ${res.status}`)
    const data = await res.json()
    const cards: GiftUpCard[] = data.giftCards ?? []
    all.push(...cards)
    if (cards.length < take) break
    skip += take
  }

  return all
}

export async function POST() {
  try {
    if (!(await checkAuth())) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    if (!GIFTUP_API_KEY) {
      return NextResponse.json({ error: 'GIFTUP_API_KEY niet ingesteld' }, { status: 500 })
    }

    const cards = await fetchAllGiftUpCards()
    let imported = 0
    let skipped  = 0
    const errors: string[] = []

    for (const card of cards) {
      try {
        const type            = mapType(card.fulfilledBy)
        const status          = mapStatus(card)
        const purchaser_name  = card.purchaserName?.trim() || 'Onbekend'
        const purchaser_email = (card.emailFulfilment?.emailAddress ?? '').trim().toLowerCase()
        const recipient_name  = card.recipientName?.trim() || 'Onbekend'
        const recipient_email = (card.recipientEmail ?? '').trim().toLowerCase()
        const personal_message = card.message?.trim() || null
        // If no expiry in GiftUp, set to 5 years from creation
        const expires_at = card.expiresOn
          ? new Date(card.expiresOn).toISOString()
          : new Date(new Date(card.createdOn).getTime() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString()
        const created_at = new Date(card.createdOn).toISOString()

        const result = await sql`
          INSERT INTO gift_cards (
            code, type, value_euros, status,
            purchaser_name, purchaser_email,
            recipient_name, recipient_email,
            personal_message, expires_at, created_at
          ) VALUES (
            ${card.code}, ${type}, ${card.initialValue}, ${status},
            ${purchaser_name}, ${purchaser_email},
            ${recipient_name}, ${recipient_email},
            ${personal_message}, ${expires_at}, ${created_at}
          )
          ON CONFLICT (code) DO NOTHING
        `
        if ((result.rowCount ?? 0) > 0) {
          imported++
        } else {
          skipped++
        }
      } catch (err) {
        errors.push(`${card.code}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      total: cards.length,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('GiftUp import error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import mislukt' },
      { status: 500 }
    )
  }
}
