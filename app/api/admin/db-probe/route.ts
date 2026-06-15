// Diagnostic: run the same SQL the cron uses, see what the runtime sees.
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

export async function GET(_request: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const inflight = await sql`
    SELECT id, preview_status, rodin_subscription_key IS NOT NULL AS has_key
    FROM ai_scans WHERE preview_status IN ('queued', 'generating') LIMIT 25
  `
  const all = await sql`SELECT COUNT(*)::int AS c FROM ai_scans`
  const byStatus = await sql`
    SELECT preview_status, COUNT(*)::int AS c FROM ai_scans GROUP BY preview_status
  `
  return NextResponse.json({
    inflight_count: inflight.rows.length,
    inflight: inflight.rows,
    total_scans: all.rows[0],
    by_preview_status: byStatus.rows,
  })
}
