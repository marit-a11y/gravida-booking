import { NextRequest, NextResponse } from 'next/server'
import { updateDiyScanner } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const scanner = await updateDiyScanner(id, body)
    if (!scanner) return NextResponse.json({ error: 'Scanner niet gevonden' }, { status: 404 })
    return NextResponse.json(scanner)
  } catch (err) {
    console.error('PUT /api/admin/diy-scanners/[id] error:', err)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}
