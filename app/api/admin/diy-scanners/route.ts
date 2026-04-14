import { NextResponse } from 'next/server'
import { getDiyScanners } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const scanners = await getDiyScanners()
    return NextResponse.json({ scanners })
  } catch (err) {
    console.error('GET /api/admin/diy-scanners error:', err)
    return NextResponse.json({ error: 'Kan scanners niet laden' }, { status: 500 })
  }
}
