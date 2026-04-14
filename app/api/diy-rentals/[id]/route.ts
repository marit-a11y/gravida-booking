import { NextRequest, NextResponse } from 'next/server'
import { getDiyRentalById } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const rental = await getDiyRentalById(id)
    if (!rental) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    // Only return limited info (public endpoint)
    return NextResponse.json({
      payment_status: rental.payment_status,
      status: rental.status,
      rental_week: rental.rental_week,
    })
  } catch (err) {
    console.error('GET /api/diy-rentals/[id] error:', err)
    return NextResponse.json({ error: 'Fout' }, { status: 500 })
  }
}
