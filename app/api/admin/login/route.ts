import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, createToken, COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (!password) {
      return NextResponse.json({ error: 'Wachtwoord is verplicht' }, { status: 400 })
    }

    const valid = await verifyAdmin(password)
    if (!valid) {
      return NextResponse.json({ error: 'Ongeldig wachtwoord' }, { status: 401 })
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      console.error('JWT_SECRET is not set')
      return NextResponse.json({ error: 'Server configuratiefout' }, { status: 500 })
    }

    const token = await createToken(secret)

    const response = NextResponse.json({ success: true })
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    })

    return response
  } catch (err) {
    console.error('POST /api/admin/login error:', err)
    return NextResponse.json({ error: 'Inloggen mislukt' }, { status: 500 })
  }
}
