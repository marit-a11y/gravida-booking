import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

// GET /api/admin/diy-scan-files/overview?q=zoekterm
// Overzicht van ALLE rentals die STL bestanden hebben, met aantallen + klantkeuze.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') ?? '').trim()
    const includeEmpty = searchParams.get('include_empty') === '1'

    const rentals = await sql`
      SELECT r.id, r.first_name, r.last_name, r.email, r.customer_number,
             r.status, r.rental_week::text, r.created_at::text,
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
           LOWER(r.first_name) LIKE ${'%' + q.toLowerCase() + '%'} OR
           LOWER(r.last_name) LIKE ${'%' + q.toLowerCase() + '%'} OR
           LOWER(r.email) LIKE ${'%' + q.toLowerCase() + '%'} OR
           LOWER(COALESCE(r.customer_number, '')) LIKE ${'%' + q.toLowerCase() + '%'})
      ORDER BY r.created_at DESC
    `
    return NextResponse.json({ rentals: rentals.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
