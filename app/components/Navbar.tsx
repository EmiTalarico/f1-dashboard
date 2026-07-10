'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, ReactElement } from 'react'
import { useSidebar } from './SidebarContext'

// ── Iconos SVG inline — trazo fino, estilo minimalista ──
const Icons: Record<string, ReactElement> = {
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
      <path d="M9 21V12h6v9"/>
    </svg>
  ),
  noticias: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/>
      <path d="M9 9h6M9 13h6M9 17h4"/>
    </svg>
  ),
  calendario: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  ),
  resultados: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  pilotos: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M6 20v-1a6 6 0 0112 0v1"/>
      <path d="M9 7.5c0 0 .5-2 3-2s3 2 3 2"/>
    </svg>
  ),
  escuderias: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 17l4-8h12l4 8"/>
      <path d="M5 17h14"/>
      <circle cx="7.5" cy="18.5" r="1.5"/>
      <circle cx="16.5" cy="18.5" r="1.5"/>
      <path d="M6 9l1-4h10l1 4"/>
    </svg>
  ),
  telemetria: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  live: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
      <path d="M8.5 8.5a5 5 0 000 7M15.5 8.5a5 5 0 010 7"/>
      <path d="M5.5 5.5a9 9 0 000 13M18.5 5.5a9 9 0 010 13"/>
    </svg>
  ),
}

const NAV_GROUPS = [
  {
    label: 'General',
    items: [
      { href: '/',         label: 'Home',       icon: 'home'      },
      { href: '/noticias', label: 'Noticias',   icon: 'noticias'  },
    ],
  },
  {
    label: 'Temporada',
    items: [
      { href: '/calendario',  label: 'Calendario',  icon: 'calendario'  },
      { href: '/resultados',  label: 'Resultados',  icon: 'resultados'  },
      { href: '/pilotos',     label: 'Pilotos',     icon: 'pilotos'     },
      { href: '/escuderias',  label: 'Escuderías',  icon: 'escuderias'  },
    ],
  },
  {
    label: 'Datos',
    items: [
      { href: '/telemetria', label: 'Telemetría', icon: 'telemetria' },
      { href: '/live',       label: 'Live',       icon: 'live'       },
    ],
  },
]

function NavItem({
  href, label, icon, active, collapsed, isLive,
}: {
  href: string; label: string; icon: string; active: boolean; collapsed: boolean; isLive: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center rounded-xl transition-all duration-150"
      style={{
        gap: collapsed ? 0 : 10,
        padding: collapsed ? 0 : '9px 12px',
        width: collapsed ? 40 : '100%',
        height: collapsed ? 40 : undefined,
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: active
          ? 'rgba(225,6,0,0.12)'
          : hovered
            ? 'rgba(255,255,255,0.05)'
            : 'transparent',
        color: active ? '#fff' : hovered ? '#fff' : 'rgba(255,255,255,0.55)',
      }}
    >
      {/* Barra activa izquierda */}
      {active && !collapsed && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 3,
            height: 18,
            background: 'var(--f1-red)',
            boxShadow: '0 0 8px rgba(225,6,0,0.6)',
          }}
        />
      )}

      {/* Anillo activo en colapsado */}
      {active && collapsed && (
        <span
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ boxShadow: '0 0 0 1.5px var(--f1-red), 0 0 14px rgba(225,6,0,0.25)' }}
        />
      )}

      {/* Icono */}
      <span
        className="shrink-0 relative z-10 transition-colors duration-150"
        style={{ color: active ? 'var(--f1-red)' : hovered ? '#fff' : 'rgba(255,255,255,0.45)' }}
      >
        {/* Live: pulso animado */}
        {isLive ? (
          <span className="relative flex items-center justify-center">
            {Icons[icon]}
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: '#e10600', boxShadow: '0 0 6px rgba(225,6,0,0.8)', animation: 'pulse 2s infinite' }}
            />
          </span>
        ) : Icons[icon]}
      </span>

      {/* Label */}
      {!collapsed && (
        <span
          className="text-sm relative z-10 transition-all duration-150"
          style={{
            fontWeight: active ? 700 : 500,
            letterSpacing: active ? '0.01em' : 'normal',
            color: active ? '#fff' : hovered ? '#fff' : 'rgba(255,255,255,0.55)',
          }}
        >
          {label}
        </span>
      )}
    </Link>
  )
}

function NavGroups({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {/* Group label — solo en expandido */}
          {!collapsed && (
            <p
              className="text-xs font-bold uppercase tracking-widest mb-1.5 px-3"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              {group.label}
            </p>
          )}

          {/* Separador en colapsado */}
          {collapsed && (
            <div
              className="mx-auto mb-2"
              style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.08)' }}
            />
          )}

          <div className={`flex flex-col gap-0.5 ${collapsed ? 'items-center' : ''}`}>
            {group.items.map(({ href, label, icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname === href}
                collapsed={collapsed}
                isLive={href === '/live'}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Navbar() {
  const { collapsed, setCollapsed } = useSidebar()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const sidebarBg = 'linear-gradient(180deg, #13131a 0%, #0e0d12 100%)'
  const sidebarBorder = '1px solid rgba(255,255,255,0.06)'

  return (
    <>
      {/* ── Sidebar desktop ── */}
      <aside
        className="hidden md:flex flex-col min-h-screen fixed left-0 top-0 z-40 transition-all duration-300"
        style={{
          width: collapsed ? 68 : 220,
          background: sidebarBg,
          borderRight: sidebarBorder,
          padding: collapsed ? '20px 0' : '20px 12px',
        }}
      >
        {/* Logo */}
        <div
          className="mb-6 transition-all duration-300"
          style={{
            padding: collapsed ? '0 8px' : '0 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          {collapsed ? (
            <img src="/favicon.ico" alt="F1Pasión" className="w-9 h-9 object-contain rounded-lg" />
          ) : (
            <img src="/logo-horizontal.png" alt="F1Pasión" className="h-7 w-auto object-contain" />
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              title="Colapsar menú"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          )}
        </div>

        {/* Botón expandir cuando colapsado */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mb-4 flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.25)' }}
            title="Expandir menú"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1">
          <NavGroups collapsed={collapsed} />
        </nav>

        {/* Línea roja de acento inferior */}
        <div
          className="mt-6 mx-auto rounded-full"
          style={{
            width: collapsed ? 20 : '100%',
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(225,6,0,0.4), transparent)',
          }}
        />
      </aside>

      {/* ── Mobile header ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{
          height: 52,
          background: 'rgba(13,13,18,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: sidebarBorder,
        }}
      >
        <img src="/logoNavbar.png" alt="F1Pasión" className="h-6 w-auto object-contain" />

        <button
          onClick={() => setMobileOpen(o => !o)}
          className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
          style={{
            background: mobileOpen ? 'rgba(225,6,0,0.12)' : 'rgba(255,255,255,0.05)',
            color: mobileOpen ? 'var(--f1-red)' : 'rgba(255,255,255,0.7)',
            border: `1px solid ${mobileOpen ? 'rgba(225,6,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {mobileOpen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          )}
        </button>
      </header>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className="md:hidden fixed top-0 left-0 bottom-0 z-40 flex flex-col overflow-y-auto transition-transform duration-300"
        style={{
          width: 260,
          background: sidebarBg,
          borderRight: sidebarBorder,
          boxShadow: mobileOpen ? '16px 0 48px rgba(0,0,0,0.6)' : 'none',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          padding: '16px 12px',
        }}
      >
        {/* Header drawer */}
        <div className="flex items-center justify-between mb-6 px-1">
          <img src="/logoNavbar.png" alt="F1Pasión" className="h-6 w-auto object-contain" />
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1">
          <NavGroups collapsed={false} />
        </nav>

        {/* Acento inferior */}
        <div
          className="mt-6 rounded-full"
          style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(225,6,0,0.4), transparent)',
          }}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </>
  )
}