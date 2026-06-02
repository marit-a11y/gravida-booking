import { NextRequest, NextResponse } from 'next/server'
import { getGiftCardById } from '@/lib/db'
import { createWooCoupon, isWooCommerceConfigured } from '@/lib/woocommerce'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Synchroniseer een gift card naar WooCommerce als coupon.
 * Idempotent: als de code al bestaat in Woo, geeft Woo een 400 en gaan
 * we daar overheen — we beschouwen dat als succes ('al gesynced').
 *
 * Bedoeld voor:
 *  - Oude Giftup-import bonnen die nog niet in Woo zaten
 *  - Bonnen die we handmatig willen reactiveren in Woo
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  if (!isWooCommerceConfigured()) {
    return NextResponse.json({ error: 'WooCommerce niet geconfigureerd' }, { status: 500 })
  }
  try {
    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Ongeldig ID' }, { status: 400 })

    const card = await getGiftCardById(id)
    if (!card) return NextResponse.json({ error: 'Cadeaubon niet gevonden' }, { status: 404 })

    if (card.status !== 'actief') {
      return NextResponse.json({
        error: `Cadeaubon staat op '${card.status}'. Eerst activeren voordat hij in Woo gesynced kan worden.`,
      }, { status: 400 })
    }

    // Bij borg_korting beperken we tot het e-mailadres van de koper
    const isBorgKorting = card.type === 'borg_korting'
    const result = await createWooCoupon({
      code: card.code,
      discount_type: 'fixed_cart',
      amount: Number(card.value_euros).toFixed(2),
      description: isBorgKorting
        ? `Borg-verrekening DIY scan kit - ${card.recipient_name}`
        : `Cadeaubon - ${card.recipient_name}`,
      email_restrictions: isBorgKorting && card.recipient_email ? [card.recipient_email] : undefined,
      date_expires: card.expires_at ?? undefined,
      usage_limit: 1,
    })

    if (!result.ok) {
      // Bestaat hij al? Dan is dat ok.
      if (result.error?.includes('woocommerce_rest_coupon_code_already_exists') || result.error?.includes('already exists')) {
        return NextResponse.json({ ok: true, message: 'Coupon bestaat al in WooCommerce', code: card.code })
      }
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
    }
    return NextResponse.json({ ok: true, code: card.code, woo_id: result.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
