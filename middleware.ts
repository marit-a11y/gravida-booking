import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  // On the dashboard.gravida.nl subdomain, redirect the root to /admin
  // (so visitors land on the admin login / dashboard, not the public booking page)
  if (host.startsWith('dashboard.') && pathname === '/') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

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
  // Run on /admin, /api/admin, and the root '/' (for the dashboard subdomain redirect)
  matcher: ['/', '/admin/:path*', '/api/admin/:path*'],
}
