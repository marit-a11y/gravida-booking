import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

interface OverviewRow {
  kind: 'rental' | 'booking'
  id: number
  first_name: string
  last_name: string
  email: string
  customer_number: string | null
  status: string
  reference_date: string  // rental_week of booking date
  file_count: number
  count_1: number
  count_2: number
  total_bytes: string  // bigint as string
  chosen_label: number | null
  consent_submitted_at: string | null
}

// GET /api/admin/diy-scan-files/overview?q=zoekterm&kind=all|rental|booking
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()
    const includeEmpty = searchParams.get('include_empty') === '1'
    const kind = searchParams.get('kind') ?? 'all'

    const rentals: OverviewRow[] = []
    const bookings: OverviewRow[] = []

    if (kind === 'all' || kind === 'rental') {
      const rRes = await sql<OverviewRow>`
        SELECT 'rental'::text as kind, r.id, r.first_name, r.last_name, r.email, r.customer_number,
               r.status, r.rental_week::text as reference_date,
               (SELECT COUNT(*) FROM diy_scan_files f
                WHERE f.rental_id = r.id AND f.deleted_at IS NULL)::int AS file_count,
               (SELECT COUNT(*) FROM diy_scan_files f
                WHERE f.rental_id = r.id AND f.deleted_at IS NULL AND f.scan_label = 1)::int AS count_1,
               (SELECT COUNT(*) FROM diy_scan_files f
                WHERE f.rental_id = r.id AND f.deleted_at IS NULL AND f.scan_label = 2)::int AS count_2,
               (SELECT COALESCE(SUM(size_bytes), 0) FROM diy_scan_files f
                WHERE f.rental_id = r.id AND f.deleted_at IS NULL)::bigint AS total_bytes,
               (SELECT preferred_scan_number FROM scan_consents c
                WHERE c.diy_rental_id = r.id ORDER BY c.id DESC LIMIT 1) AS chosen_label,
               (SELECT submitted_at::text FROM scan_consents c
                WHERE c.diy_rental_id = r.id ORDER BY c.id DESC LIMIT 1) AS consent_submitted_at
        FROM diy_rentals r
        WHERE (${includeEmpty} OR EXISTS (
          SELECT 1 FROM diy_scan_files f WHERE f.rental_id = r.id AND f.deleted_at IS NULL
        ))
        AND (${q} = '' OR
             LOWER(r.first_name) LIKE ${'%' + q + '%'} OR
             LOWER(r.last_name) LIKE ${'%' + q + '%'} OR
             LOWER(r.email) LIKE ${'%' + q + '%'} OR
             LOWER(COALESCE(r.customer_number, '')) LIKE ${'%' + q + '%'})
        ORDER BY r.created_at DESC
      `
      rentals.push(...rRes.rows)
    }

    if (kind === 'all' || kind === 'booking') {
      const bRes = await sql<OverviewRow>`
        SELECT 'booking'::text as kind, b.id, b.first_name, b.last_name, b.email, b.customer_number,
               b.status, COALESCE(b.date, a.date)::text as reference_date,
               (SELECT COUNT(*) FROM diy_scan_files f
                WHERE f.booking_id = b.id AND f.deleted_at IS NULL)::int AS file_count,
               (SELECT COUNT(*) FROM diy_scan_files f
                WHERE f.booking_id = b.id AND f.deleted_at IS NULL AND f.scan_label = 1)::int AS count_1,
               (SELECT COUNT(*) FROM diy_scan_files f
                WHERE f.booking_id = b.id AND f.deleted_at IS NULL AND f.scan_label = 2)::int AS count_2,
               (SELECT COALESCE(SUM(size_bytes), 0) FROM diy_scan_files f
                WHERE f.booking_id = b.id AND f.deleted_at IS NULL)::bigint AS total_bytes,
               (SELECT preferred_scan_number FROM scan_consents c
                WHERE c.booking_id = b.id ORDER BY c.id DESC LIMIT 1) AS chosen_label,
               (SELECT submitted_at::text FROM scan_consents c
                WHERE c.booking_id = b.id ORDER BY c.id DESC LIMIT 1) AS consent_submitted_at
        FROM bookings b LEFT JOIN availability a ON b.availability_id = a.id
        WHERE (${includeEmpty} OR EXISTS (
          SELECT 1 FROM diy_scan_files f WHERE f.booking_id = b.id AND f.deleted_at IS NULL
        ))
        AND (${q} = '' OR
             LOWER(b.first_name) LIKE ${'%' + q + '%'} OR
             LOWER(b.last_name) LIKE ${'%' + q + '%'} OR
             LOWER(b.email) LIKE ${'%' + q + '%'} OR
             LOWER(COALESCE(b.customer_number, '')) LIKE ${'%' + q + '%'})
        ORDER BY b.created_at DESC
      `
      bookings.push(...bRes.rows)
    }

    // Combineer en sorteer op reference_date desc
    const combined = [...rentals, ...bookings].sort((a, b) =>
      (b.reference_date ?? '').localeCompare(a.reference_date ?? '')
    )
    return NextResponse.json({ rentals: combined })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
