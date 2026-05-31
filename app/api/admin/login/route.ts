import { NextRequest, NextResponse } from 'next/server'
import { verifyLogin, createToken, COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const email = (body.email ?? '').toString().trim()
    const password = (body.password ?? '').toString()

    if (!password) {
      return NextResponse.json({ error: 'Wachtwoord is verplicht' }, { status: 400 })
    }

    const user = await verifyLogin(email, password)
    if (!user) {
      return NextResponse.json({ error: 'Ongeldige inloggegevens' }, { status: 401 })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('JWT_SECRET is not set')
      return NextResponse.json({ error: 'Server configuratiefout' }, { status: 500 })
    }

    const token = await createToken(secret, user)

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin },
    })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('POST /api/admin/login error:', err)
    return NextResponse.json({ error: 'Inloggen mislukt' }, { status: 500 })
  }
}
