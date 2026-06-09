// GET /api/admin/ai-scans
//
// Lists Atelier AI scan submissions. Query params:
//   status — filter by status (received, reviewing, approved, rejected)
//   q      — text search across name/email/customer_number
//
// Returns: { scans: [{ id, session_id, name, email, status, photo_count, ... }] }

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyTokenValid as verifyToken, COOKIE_NAME } from '@/lib/auth'
import { sql } from '@vercel/postgres'

export const dynamic = 'force-dynamic'

async function checkAuth(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  const secret = process.env.JWT_SECRET ?? process.env.ADMIN_PASSWORD ?? ''
  return verifyToken(token, secret)
}

export async function GET(request: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = (searchParams.get('status') ?? '').trim()
  const q      = (searchParams.get('q')      ?? '').trim()

  // We build the WHERE clause as a parameterised string. @vercel/postgres
  // doesn't have a query builder so we keep this narrow and well-typed.
  if (status && q) {
    const like = `%${q}%`
    const r = await sql`
      SELECT s.*, COALESCE(pc.c, 0) AS photo_count
      FROM ai_scans s
      LEFT JOIN (
        SELECT scan_id, COUNT(*)::int AS c FROM ai_scan_photos GROUP BY scan_id
      ) pc ON pc.scan_id = s.id
      WHERE s.status = ${status}
        AND (
          LOWER(COALESCE(s.client_first_name, '') || ' ' || COALESCE(s.client_last_name, '')) LIKE LOWER(${like})
          OR LOWER(COALESCE(s.client_email, '')) LIKE LOWER(${like})
          OR COALESCE(s.customer_number, '') LIKE ${like}
        )
      ORDER BY s.created_at DESC
      LIMIT 200
    `
    return NextResponse.json({ scans: r.rows })
  }
  if (status) {
    const r = await sql`
      SELECT s.*, COALESCE(pc.c, 0) AS photo_count
      FROM ai_scans s
      LEFT JOIN (
        SELECT scan_id, COUNT(*)::int AS c FROM ai_scan_photos GROUP BY scan_id
      ) pc ON pc.scan_id = s.id
      WHERE s.status = ${status}
      ORDER BY s.created_at DESC
      LIMIT 200
    `
    return NextResponse.json({ scans: r.rows })
  }
  if (q) {
    const like = `%${q}%`
    const r = await sql`
      SELECT s.*, COALESCE(pc.c, 0) AS photo_count
      FROM ai_scans s
      LEFT JOIN (
        SELECT scan_id, COUNT(*)::int AS c FROM ai_scan_photos GROUP BY scan_id
      ) pc ON pc.scan_id = s.id
      WHERE (
        LOWER(COALESCE(s.client_first_name, '') || ' ' || COALESCE(s.client_last_name, '')) LIKE LOWER(${like})
        OR LOWER(COALESCE(s.client_email, '')) LIKE LOWER(${like})
        OR COALESCE(s.customer_number, '') LIKE ${like}
      )
      ORDER BY s.created_at DESC
      LIMIT 200
    `
    return NextResponse.json({ scans: r.rows })
  }

  const r = await sql`
    SELECT s.*, COALESCE(pc.c, 0) AS photo_count
    FROM ai_scans s
    LEFT JOIN (
      SELECT scan_id, COUNT(*)::int AS c FROM ai_scan_photos GROUP BY scan_id
    ) pc ON pc.scan_id = s.id
    ORDER BY s.created_at DESC
    LIMIT 200
  `
  return NextResponse.json({ scans: r.rows })
}
