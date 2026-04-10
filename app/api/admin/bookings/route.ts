import { NextRequest, NextResponse } from 'next/server'
import { getBookings, getStats } from '@/lib/db'
import { bookingsToCsv } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') ?? undefined
    const region = searchParams.get('region') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const exportCsv = searchParams.get('export') === 'csv'
    const includeStats = searchParams.get('stats') === '1'

    const bookings = await getBookings({ date, region, status })

    // CSV export
    if (exportCsv) {
      const csv = bookingsToCsv(bookings as unknown as Record<string, unknown>[])
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="gravida-boekingen-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Include stats if requested
    if (includeStats) {
      const stats = await getStats()
      return NextResponse.json({ bookings, stats })
    }

    return NextResponse.json({ bookings })
  } catch (err) {
    console.error('GET /api/admin/bookings error:', err)
    return NextResponse.json({ error: 'Kan boekingen niet laden' }, { status: 500 })
  }
}
