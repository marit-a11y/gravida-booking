import { NextResponse } from 'next/server'
import { generateStandardAvailability } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  try {
    const inserted = await generateStandardAvailability(12)
    return NextResponse.json({ ok: true, inserted, message: `${inserted} nieuwe beschikbaarheden aangemaakt` })
  } catch (err) {
    console.error('POST /api/admin/availability/auto-generate error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
