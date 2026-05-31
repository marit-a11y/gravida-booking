import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

// Pages die ELKE ingelogde gebruiker mag zien (ongeacht allowed_pages),
// bv. de homepage van de admin en de gebruikers-eigen profielpagina later.
const ALWAYS_ALLOWED_PREFIXES = ['/admin/login', '/admin/profiel']

function pageSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith('/admin')) return null
  const stripped = pathname.replace(/^\/admin\/?/, '')
  if (!stripped) return 'dashboard'
  const first = stripped.split('/')[0]
  return first || 'dashboard'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const host = request.headers.get('host') ?? ''

  // dashboard subdomain landing
  if (host.startsWith('dashboard.') && pathname === '/') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // /admin routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get(COOKIE_NAME)?.value
    const secret = process.env.JWT_SECRET ?? ''
    const payload = token ? await verifyToken(token, secret) : null

    if (!payload) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Page-level toegangscontrole (admins mogen alles)
    if (!payload.is_admin && !ALWAYS_ALLOWED_PREFIXES.some(p => pathname.startsWith(p))) {
      const slug = pageSlugFromPath(pathname)
      const allowed = Array.isArray(payload.allowed_pages) ? payload.allowed_pages : []
      if (slug && !allowed.includes(slug)) {
        // Redirect naar eerste pagina waar gebruiker wél bij mag
        const fallback = allowed[0]
        const target = fallback ? `/admin/${fallback === 'dashboard' ? '' : fallback}` : '/admin/login'
        return NextResponse.redirect(new URL(target, request.url))
      }
    }
  }

  // /api/admin routes — alleen login-check, geen page-level (UI doet dat)
  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/login')) {
    const token = request.cookies.get(COOKIE_NAME)?.value
    const secret = process.env.JWT_SECRET ?? ''
    const payload = token ? await verifyToken(token, secret) : null
    if (!payload) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/admin/:path*', '/api/admin/:path*'],
}
