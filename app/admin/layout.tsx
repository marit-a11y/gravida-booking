'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const navItems = [
  { href: '/admin/inbox',           slug: 'inbox',           label: 'Inbox',          icon: '📥', inboxBadge: true },
  { href: '/admin',                 slug: 'dashboard',       label: 'Dashboard',      icon: '◈' },
  { href: '/admin/beschikbaarheid', slug: 'beschikbaarheid', label: 'Beschikbaarheid', icon: '◷' },
  { href: '/admin/boekingen',       slug: 'boekingen',       label: 'Boekingen',      icon: '◻' },
  { href: '/admin/medewerkers',     slug: 'medewerkers',     label: 'Medewerkers',    icon: '◎' },
  { href: '/admin/afwezigheid',     slug: 'afwezigheid',     label: 'Afwezigheid',    icon: '◌' },
  { href: '/admin/diy-scanners',    slug: 'diy-scanners',    label: 'DIY Scanners',   icon: '◆' },
  { href: '/admin/diy-beoordeling', slug: 'diy-beoordeling', label: 'Scan beoordeling', icon: '✓', badge: true },
  { href: '/admin/scan-archief',    slug: 'scan-archief',    label: 'Scan archief',   icon: '🗄' },
  { href: '/admin/cadeaubonnen',    slug: 'cadeaubonnen',    label: 'Cadeaubonnen',   icon: '🎁' },
  { href: '/admin/bestellingen',    slug: 'bestellingen',    label: 'Webshop orders', icon: '🛒', wooBadge: true },
  { href: '/admin/social',          slug: 'social',          label: 'Social planner', icon: '📅' },
  { href: '/admin/media-library',   slug: 'media-library',   label: 'Mediabibliotheek', icon: '📂' },
  { href: '/admin/galleries',       slug: 'galleries',       label: 'Galerijen',      icon: '🖼️' },
  { href: '/admin/blogs',           slug: 'blogs',           label: 'Blogs',          icon: '✍️' },
  { href: '/admin/gedeelde-beelden', slug: 'gedeelde-beelden', label: 'Gedeelde beelden', icon: '💝' },
  { href: '/admin/scanweek',        slug: 'scanweek',        label: 'Scanweek aanmeldingen', icon: '🔔' },
  { href: '/admin/whatsapp-test',   slug: 'whatsapp-test',   label: 'WhatsApp test',  icon: '💬' },
  { href: '/admin/task-tracker',    slug: 'task-tracker',    label: 'Task tracker',   icon: '🐞' },
  { href: '/admin/gebruikers',      slug: 'gebruikers',      label: 'Gebruikers',     icon: '👤', adminOnly: true },
  { href: 'https://clarity.microsoft.com/projects', slug: 'clarity', label: 'Bezoekersanalyse', icon: '📊', external: true, adminOnly: true },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [uitzoekCount, setUitzoekCount] = useState(0)
  const [inboxCount, setInboxCount] = useState(0)
  const [wooCount, setWooCount] = useState(0)
  const [me, setMe] = useState<{ name: string; is_admin: boolean; allowed_pages: string[] } | null>(null)

  // Load current user
  useEffect(() => {
    if (pathname === '/admin/login') return
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) setMe({ name: d.user.name, is_admin: d.user.is_admin, allowed_pages: d.user.allowed_pages ?? [] }) })
      .catch(() => {})
  }, [pathname])

  const visibleNavItems = navItems.filter(item => {
    if (!me) return false
    if (me.is_admin) return true
    if (item.adminOnly) return false
    return me.allowed_pages.includes(item.slug)
  })

  // Poll for pending scan reviews
  useEffect(() => {
    if (pathname === '/admin/login') return
    const fetchCount = async () => {
      try {
        // Tel zowel 'retour' (net binnengekomen) als 'uitzoeken' (wordt aan gewerkt)
        const [retour, uitzoeken] = await Promise.all([
          fetch('/api/admin/diy-rentals?status=retour', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
          fetch('/api/admin/diy-rentals?status=uitzoeken', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        ])
        const retourList = retour?.rentals ?? retour ?? []
        const uitzoekList = uitzoeken?.rentals ?? uitzoeken ?? []
        const total = (Array.isArray(retourList) ? retourList.length : 0)
                    + (Array.isArray(uitzoekList) ? uitzoekList.length : 0)
        setUitzoekCount(total)
      } catch { /* ignore */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [pathname])

  // Poll for new WooCommerce orders (processing + on-hold)
  useEffect(() => {
    if (pathname === '/admin/login') return
    const fetchWoo = async () => {
      try {
        const r = await fetch('/api/admin/woo-orders/count', { credentials: 'include' })
        if (r.ok) {
          const d = await r.json()
          setWooCount(d.count ?? 0)
        }
      } catch { /* ignore */ }
    }
    fetchWoo()
    const interval = setInterval(fetchWoo, 60_000)  // 1 minuut
    return () => clearInterval(interval)
  }, [pathname])

  // Poll for unread inbox items
  useEffect(() => {
    if (pathname === '/admin/login') return
    const me = (typeof window !== 'undefined' && localStorage.getItem('inbox_me')) || 'Marit'
    const fetchInbox = async () => {
      try {
        const res = await fetch(`/api/admin/inbox?recipient=${encodeURIComponent(me)}&unread=1`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setInboxCount(data.unread_count ?? 0)
        }
      } catch { /* ignore */ }
    }
    fetchInbox()
    const interval = setInterval(fetchInbox, 30_000)
    return () => clearInterval(interval)
  }, [pathname])

  // Don't show layout on login page
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const currentLabel = navItems.find(
    (item) => item.href === pathname || (item.href !== '/admin' && pathname.startsWith(item.href))
  )?.label ?? 'Dashboard'

  return (
    <div className="min-h-screen flex bg-gravida-off-white">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-gravida-green text-white flex-col shrink-0">
        {/* Brand */}
        <div className="px-6 py-6 border-b border-white/10">
          <p className="text-lg font-semibold tracking-tight">Gravida</p>
          <p className="text-gravida-light-sage text-xs mt-0.5">Beheerportaal</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNavItems.map((item) => {
            const active = !item.external && (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)))
            const count = item.inboxBadge ? inboxCount : item.wooBadge ? wooCount : (item.badge ? uitzoekCount : 0)
            const className = `
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
              ${active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}
            `
            const inner = (
              <>
                <span className="text-base">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.external && <span className="text-[10px] opacity-60">↗</span>}
                {count > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </>
            )
            return item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>
                {inner}
              </a>
            ) : (
              <Link key={item.href} href={item.href} className={className}>
                {inner}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span>⇥</span>
            Uitloggen
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gravida-green text-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
          <div>
            <p className="text-sm font-semibold tracking-tight">Gravida</p>
            <p className="text-[10px] text-white/60">{currentLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/70 hover:text-white transition-colors"
        >
          Uitloggen
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <nav className="absolute top-[60px] left-0 right-0 bg-gravida-green px-3 py-3 space-y-1 shadow-xl">
            {visibleNavItems.map((item) => {
              const active = !item.external && (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)))
              const count = item.inboxBadge ? inboxCount : item.wooBadge ? wooCount : (item.badge ? uitzoekCount : 0)
              const className = `
                flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                ${active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}
              `
              const inner = (
                <>
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.external && <span className="text-[10px] opacity-60">↗</span>}
                  {count > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </>
              )
              return item.external ? (
                <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)} className={className}>
                  {inner}
                </a>
              ) : (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={className}>
                  {inner}
                </Link>
              )
            })}
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 md:px-8 md:py-8 mt-[60px] md:mt-0">
          {children}
        </div>
      </main>
    </div>
  )
}
