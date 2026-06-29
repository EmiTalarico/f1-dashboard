'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useSidebar } from './SidebarContext'

const NAV_ITEMS = [
  { href: '/',            label: 'Home',       icon: '🏠', ready: true  },
  { href: '/noticias',    label: 'Noticias',   icon: '📰', ready: true  },
  { href: '/calendario',  label: 'Calendario', icon: '📅', ready: true  },
  { href: '/resultados',  label: 'Resultados', icon: '🏆', ready: true  },
  { href: '/escuderias',  label: 'Escuderías', icon: '🏎️', ready: true  },
  { href: '/telemetria',  label: 'Telemetría', icon: '📡', ready: true  },
  { href: '/live',        label: 'Live',       icon: '🔴', ready: true  },
]

function NavLinks({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()
  return (
    <>
      {NAV_ITEMS.map(({ href, label, icon, ready }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={ready ? href : '#'}
            title={collapsed ? label : undefined}
            className={`relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 ${
              collapsed ? 'justify-center w-11 h-11 mx-auto' : 'gap-3 px-3.5 py-2.5'
            } ${!ready ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'}`}
            style={{
              background: active ? 'rgba(225,6,0,0.10)' : 'transparent',
              color: active ? 'var(--f1-red)' : 'var(--f1-text)',
            }}
          >
            {/* Indicador activo: barra a la izquierda en expandido, anillo en colapsado */}
            {active && !collapsed && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full"
                style={{ background: 'var(--f1-red)', boxShadow: '0 0 8px var(--f1-red-glow)' }}
              />
            )}
            {active && collapsed && (
              <span
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{ boxShadow: '0 0 0 1px var(--f1-red), 0 0 12px var(--f1-red-glow)' }}
              />
            )}

            <span className="text-lg leading-none shrink-0 relative z-10">{icon}</span>

            {!collapsed && (
              <>
                <span className="truncate relative z-10">{label}</span>
                {!ready && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full shrink-0 relative z-10"
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
}

export default function Navbar() {
  const pathname = usePathname()
  const { collapsed, setCollapsed } = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [pathname])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside
        className="hidden md:flex flex-col min-h-screen fixed left-0 top-0 py-5 z-40 transition-all duration-300"
        style={{
          width: collapsed ? '76px' : '232px',
          background: 'linear-gradient(180deg, #16161c 0%, #100f13 100%)',
          borderRight: '1px solid var(--f1-card-border)',
          paddingLeft: collapsed ? '0' : '14px',
          paddingRight: collapsed ? '0' : '14px',
        }}
      >
        {/* Logo + toggle */}
        <div className={`flex items-center mb-6 ${collapsed ? 'flex-col gap-3 px-2' : 'justify-between px-1'}`}>
          {!collapsed ? (
            <img src="/logo-horizontal.png" alt="F1Pasión" className="h-8 w-auto object-contain" />
          ) : (
            <img src="/favicon.ico" alt="F1Pasión" className="h-12 w-12 object-contain rounded-md" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/5 transition-colors shrink-0"
            style={{ color: 'var(--f1-muted)' }}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            <span className="text-xs" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>
              ◀
            </span>
          </button>
        </div>

        <div className={`f1-divider mb-4 ${collapsed ? 'mx-2' : ''}`} />

        <nav className={`flex flex-col gap-1 ${collapsed ? '' : 'px-0'}`}>
          <NavLinks collapsed={collapsed} />
        </nav>
      </aside>

      {/* ── Mobile header ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3"
        style={{
          background: 'linear-gradient(180deg, #16161c 0%, #100f13 100%)',
          borderBottom: '1px solid var(--f1-card-border)',
        }}
      >
        <img src="/logoNavbar.png" alt="F1Pasión" className="h-7 w-auto object-contain" />
        <button
          onClick={() => setMobileOpen(o => !o)}
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/5 transition-colors text-lg"
          style={{ color: 'var(--f1-text)' }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="md:hidden fixed top-0 left-0 bottom-0 z-40 flex flex-col py-5 px-3.5 gap-1 transition-transform duration-300 overflow-y-auto"
        style={{
          width: '250px',
          background: 'linear-gradient(180deg, #16161c 0%, #100f13 100%)',
          borderRight: '1px solid var(--f1-card-border)',
          boxShadow: mobileOpen ? '8px 0 32px rgba(0,0,0,0.5)' : 'none',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        <div className="flex items-center justify-between mb-5 px-1">
          <img src="/logoNavbar.png" alt="F1Pasión" className="h-7 w-auto object-contain" />
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5"
            style={{ color: 'var(--f1-muted)' }}
          >
            ✕
          </button>
        </div>
        <div className="f1-divider mb-4" />
        <nav className="flex flex-col gap-1">
          <NavLinks collapsed={false} />
        </nav>
      </div>
    </>
  )
}