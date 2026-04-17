import { NextRequest, NextResponse } from 'next/server'
import { generateStandardAvailability } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (or manually with the secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const inserted = await generateStandardAvailability(12)
    return NextResponse.json({ ok: true, inserted })
  } catch (err) {
    console.error('cron/auto-availability error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
