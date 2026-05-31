import { NextRequest, NextResponse } from 'next/server'
import { getWooOrders } from '@/lib/woocommerce'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const status = searchParams.get('status') ?? 'all'
  const search = searchParams.get('search') ?? undefined
  const result = await getWooOrders({ page, perPage: 25, status, search })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }
  return NextResponse.json({
    orders: result.orders,
    totalPages: result.totalPages,
    totalCount: result.totalCount,
  })
}
