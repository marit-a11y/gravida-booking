import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /admin routes (except login)
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(COOKIE_NAME)?.value
    const secret = process.env.JWT_SECRET ?? ''

    if (!token || !(await verifyToken(token, secret))) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Also protect /api/admin routes (except login)
  if (
    pathname.startsWith('/api/admin') &&
    !pathname.startsWith('/api/admin/login')
  ) {
    const token = request.cookies.get(COOKIE_NAME)?.value
    const secret = process.env.JWT_SECRET ?? ''

    if (!token || !(await verifyToken(token, secret))) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
