import { NextRequest, NextResponse } from 'next/server'
import { updateDiyRental } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const rental = await updateDiyRental(id, body)
    if (!rental) return NextResponse.json({ error: 'Reservering niet gevonden' }, { status: 404 })
    return NextResponse.json(rental)
  } catch (err) {
    console.error('PUT /api/admin/diy-rentals/[id] error:', err)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}
