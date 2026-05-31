import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const secret = process.env.JWT_SECRET ?? ''
  const payload = token ? await verifyToken(token, secret) : null
  if (!payload) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  return NextResponse.json({
    user: {
      id: payload.user_id,
      name: payload.name,
      email: payload.email,
      is_admin: payload.is_admin,
      allowed_pages: payload.allowed_pages,
    },
  })
}
