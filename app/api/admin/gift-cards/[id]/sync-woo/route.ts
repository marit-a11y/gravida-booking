import { NextRequest, NextResponse } from 'next/server'
import { getGiftCardById } from '@/lib/db'
import { createWooCoupon, getWooCouponByCode, updateWooCoupon, isWooCommerceConfigured } from '@/lib/woocommerce'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Synchroniseer een gift card naar WooCommerce als coupon.
 *  - Bestaat de coupon nog niet: aanmaken
 *  - Bestaat hij al: e-mail restrictie wegzetten + bedrag/expires bijwerken
 *
 * Borg-bonnen krijgen GEEN email_restrictions, zodat klanten ook met
 * een ander mail-adres kunnen afrekenen. De coupon-code is uniek genoeg
 * als bescherming.
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

    const amount = Number(card.value_euros).toFixed(2)
    const description = card.type === 'borg_korting'
      ? `Borg-verrekening DIY scan kit - ${card.recipient_name}`
      : `Cadeaubon - ${card.recipient_name}`

    // Bestaat hij al?
    const found = await getWooCouponByCode(card.code)
    if (found.ok && found.id) {
      // Update: bedrag + omschrijving + expires + e-mail restricties leegmaken
      const upd = await updateWooCoupon(found.id, {
        amount,
        description,
        email_restrictions: [],
        date_expires: card.expires_at ?? undefined,
      })
      if (!upd.ok) {
        return NextResponse.json({ ok: false, error: 'Update mislukt: ' + upd.error }, { status: 502 })
      }
      return NextResponse.json({ ok: true, action: 'updated', code: card.code, woo_id: found.id })
    }

    // Anders: aanmaken (zonder email_restrictions)
    const created = await createWooCoupon({
      code: card.code,
      discount_type: 'fixed_cart',
      amount,
      description,
      date_expires: card.expires_at ?? undefined,
      usage_limit: 1,
    })
    if (!created.ok) {
      if (created.error?.includes('already_exists') || created.error?.includes('already exists')) {
        return NextResponse.json({ ok: true, action: 'exists', code: card.code, message: 'Coupon bestond al maar niet via lookup gevonden' })
      }
      return NextResponse.json({ ok: false, error: created.error }, { status: 502 })
    }
    return NextResponse.json({ ok: true, action: 'created', code: card.code, woo_id: created.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
