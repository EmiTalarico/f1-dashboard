'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const NAV_ITEMS = [
  { href: '/',            label: 'Home',       icon: '🏠', ready: true  },
  { href: '/noticias',    label: 'Noticias',   icon: '📰', ready: true  },
  { href: '/calendario',  label: 'Calendario', icon: '📅', ready: true  },
  { href: '/resultados',  label: 'Resultados', icon: '🏆', ready: true  },
  { href: '/escuderias',  label: 'Escuderías', icon: '🏎️', ready: true  },
  { href: '/telemetria',  label: 'Telemetría', icon: '📡', ready: true  },
  { href: '/live',        label: 'Live',       icon: '🔴', ready: true  },
]

export default function Navbar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Cerrar drawer mobile al navegar
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Cerrar drawer al presionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const NavLinks = () => (
    <>
      {NAV_ITEMS.map(({ href, label, icon, ready }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={ready ? href : '#'}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              !ready ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80'
            }`}
            style={{
              background: active ? 'var(--f1-light-gray)' : 'transparent',
              color: active ? 'var(--f1-red)' : 'var(--f1-text)',
              borderLeft: active ? '3px solid var(--f1-red)' : '3px solid transparent',
            }}
          >
            <span className="text-lg shrink-0">{icon}</span>
            {!collapsed && (
              <>
                <span className="truncate">{label}</span>
                {!ready && (
                  <span className="ml-auto text-xs px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-muted)' }}>
                    pronto
                  </span>
                )}
              </>
            )}
          </Link>
        )
      })}
    </>
  )

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside
        className="hidden md:flex flex-col min-h-screen fixed left-0 top-0 py-6 px-3 gap-1 z-40 transition-all duration-300"
        style={{
          width: collapsed ? '60px' : '220px',
          background: 'var(--f1-gray)',
          borderRight: '1px solid var(--f1-light-gray)',
        }}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between mb-6 px-1">
          {!collapsed && (
            <img src="/logoNavbar.png" alt="F1Pasión" className="h-30 w-auto" />
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="p-1.5 rounded-lg hover:opacity-70 transition-opacity shrink-0"
            style={{ color: 'var(--f1-muted)', marginLeft: collapsed ? 'auto' : '0' }}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        <NavLinks />
      </aside>

      {/* ── Mobile header ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--f1-gray)', borderBottom: '1px solid var(--f1-light-gray)' }}
      >
        <img src="/logo-horizontal.png" alt="F1Pasión" className="h-8 w-auto" />
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="p-2 rounded-lg hover:opacity-70 transition-opacity text-xl"
          style={{ color: 'var(--f1-text)' }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="md:hidden fixed top-0 left-0 bottom-0 z-40 flex flex-col py-6 px-3 gap-1 transition-transform duration-300"
        style={{
          width: '240px',
          background: 'var(--f1-gray)',
          borderRight: '1px solid var(--f1-light-gray)',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div className="flex items-center justify-between mb-6 px-1">
          <img src="/logoNavbar.png" alt="F1Pasión" className="h-30 w-auto" />
          <button onClick={() => setMobileOpen(false)} style={{ color: 'var(--f1-muted)' }}>✕</button>
        </div>
        <NavLinks />
      </div>
    </>
  )
}