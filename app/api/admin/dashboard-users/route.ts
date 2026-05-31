import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { verifyToken, COOKIE_NAME, hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function requireAdmin(request: NextRequest): Promise<{ ok: true } | NextResponse> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token, process.env.JWT_SECRET ?? '') : null
  if (!payload) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!payload.is_admin) return NextResponse.json({ error: 'Alleen admin' }, { status: 403 })
  return { ok: true }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request)
  if ('status' in guard) return guard
  try {
    const r = await sql`
      SELECT id, name, email, is_admin, allowed_pages, is_active,
             last_login::text, created_at::text
      FROM dashboard_users
      ORDER BY is_admin DESC, name ASC
    `
    return NextResponse.json({ users: r.rows })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request)
  if ('status' in guard) return guard
  try {
    const body = await request.json()
    const { name, email, password, is_admin, allowed_pages } = body
    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: 'Naam, e-mail en wachtwoord verplicht' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Wachtwoord moet minstens 8 tekens zijn' }, { status: 400 })
    }
    const hash = await hashPassword(password)
    const pages = Array.isArray(allowed_pages) ? allowed_pages : []
    const r = await sql`
      INSERT INTO dashboard_users (name, email, password_hash, is_admin, allowed_pages)
      VALUES (${name.trim()}, ${email.trim().toLowerCase()}, ${hash},
              ${!!is_admin}, ${JSON.stringify(pages)}::jsonb)
      RETURNING id, name, email, is_admin, allowed_pages, is_active
    `
    return NextResponse.json({ user: r.rows[0] }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('duplicate key')) {
      return NextResponse.json({ error: 'Deze e-mail bestaat al' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + msg }, { status: 500 })
  }
}
