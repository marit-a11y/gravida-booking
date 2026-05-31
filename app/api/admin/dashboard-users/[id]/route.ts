import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { verifyToken, COOKIE_NAME, hashPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function requireAdmin(request: NextRequest): Promise<{ ok: true; selfId: number } | NextResponse> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const payload = token ? await verifyToken(token, process.env.JWT_SECRET ?? '') : null
  if (!payload) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  if (!payload.is_admin) return NextResponse.json({ error: 'Alleen admin' }, { status: 403 })
  return { ok: true, selfId: payload.user_id }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard
  try {
    const id = parseInt(params.id, 10)
    const body = await request.json()
    const existing = await sql`SELECT * FROM dashboard_users WHERE id = ${id}`
    if (existing.rows.length === 0) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const ex = existing.rows[0]

    let password_hash = ex.password_hash
    if (body.password && typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: 'Wachtwoord moet minstens 8 tekens zijn' }, { status: 400 })
      }
      password_hash = await hashPassword(body.password)
    }
    const pages = body.allowed_pages !== undefined
      ? (Array.isArray(body.allowed_pages) ? body.allowed_pages : [])
      : ex.allowed_pages

    // Veiligheid: voorkom dat admin zichzelf demoot of deactiveert (dan kan niemand meer in)
    let is_admin = body.is_admin !== undefined ? !!body.is_admin : ex.is_admin
    let is_active = body.is_active !== undefined ? !!body.is_active : ex.is_active
    if (guard.selfId === id) {
      // Forceer dat zelfaanpassing niet het laatste admin-account onbruikbaar maakt
      const otherAdmins = await sql`SELECT COUNT(*)::int AS c FROM dashboard_users WHERE id != ${id} AND is_admin = TRUE AND is_active = TRUE`
      if (otherAdmins.rows[0].c === 0 && (!is_admin || !is_active)) {
        return NextResponse.json({ error: 'Je bent de enige admin — je kunt jezelf niet uitschakelen' }, { status: 400 })
      }
    }

    await sql`
      UPDATE dashboard_users SET
        name = ${body.name !== undefined ? body.name : ex.name},
        email = ${body.email !== undefined ? body.email.trim().toLowerCase() : ex.email},
        password_hash = ${password_hash},
        is_admin = ${is_admin},
        is_active = ${is_active},
        allowed_pages = ${JSON.stringify(pages)}::jsonb
      WHERE id = ${id}
    `
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin(request)
  if (guard instanceof NextResponse) return guard
  try {
    const id = parseInt(params.id, 10)
    if (guard.selfId === id) {
      return NextResponse.json({ error: 'Je kunt jezelf niet verwijderen' }, { status: 400 })
    }
    await sql`DELETE FROM dashboard_users WHERE id = ${id}`
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
