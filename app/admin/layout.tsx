'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '◈' },
  { href: '/admin/beschikbaarheid', label: 'Beschikbaarheid', icon: '◷' },
  { href: '/admin/boekingen', label: 'Boekingen', icon: '◻' },
  { href: '/admin/medewerkers', label: 'Medewerkers', icon: '◎' },
  { href: '/admin/afwezigheid', label: 'Afwezigheid', icon: '◌' },
  { href: '/admin/diy-scanners', label: 'DIY Scanners', icon: '◆' },
  { href: '/admin/cadeaubonnen', label: 'Cadeaubonnen', icon: '🎁' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

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
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${active
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
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
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                    ${active
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
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
