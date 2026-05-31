import { NextResponse } from 'next/server'
import { getWooOrders } from '@/lib/woocommerce'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * Lichtgewicht count voor de sidebar badge.
 * Telt orders met status 'processing' of 'on-hold' (= nieuwe / nog te
 * verwerken bestellingen). Gebruikt per_page=1 zodat we alleen het
 * totaal-aantal uit de headers nodig hebben.
 */
export async function GET() {
  // Twee statussen tellen — WC ondersteunt geen OR in één call, dus we doen het in twee
  const [processing, onHold] = await Promise.all([
    getWooOrders({ page: 1, perPage: 1, status: 'processing' }),
    getWooOrders({ page: 1, perPage: 1, status: 'on-hold' }),
  ])
  if (!processing.ok && !onHold.ok) {
    return NextResponse.json({ count: 0, error: processing.error ?? onHold.error }, { status: 502 })
  }
  const count = (processing.totalCount ?? 0) + (onHold.totalCount ?? 0)
  return NextResponse.json({
    count,
    processing: processing.totalCount ?? 0,
    on_hold: onHold.totalCount ?? 0,
  })
}
