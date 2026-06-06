'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',            label: 'Home',       icon: '🏠', ready: true  },
  { href: '/noticias',    label: 'Noticias',   icon: '📰', ready: true  },
  { href: '/calendario',  label: 'Calendario', icon: '📅', ready: true  },
  { href: '/resultados',  label: 'Resultados', icon: '🏆', ready: true  },
  { href: '/escuderias',  label: 'Escuderías', icon: '🏎️', ready: true  },
  { href: '/telemetria',  label: 'Telemetría', icon: '📡', ready: true  },
  { href: '/live',        label: 'Live',       icon: '🔴', ready: false },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <>
      {/* Sidebar — desktop */}
      <aside
        className="hidden md:flex flex-col w-56 min-h-screen fixed left-0 top-0 py-8 px-4 gap-1"
        style={{ background: 'var(--f1-gray)', borderRight: '1px solid var(--f1-light-gray)' }}
      >
        <div className="px-8 mb-8">
          <img
            src="/logoNavbar.png"
            alt="F1Pasión"
            className="h-30 w-auto"
          />
      </div>

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
              <span>{icon}</span>
              <span>{label}</span>
              {!ready && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--f1-light-gray)', color: 'var(--f1-muted)' }}>
                  pronto
                </span>
              )}
            </Link>
          )
        })}
      </aside>

      {/* Bottom nav — mobile */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around items-center py-2 z-50"
        style={{ background: 'var(--f1-gray)', borderTop: '1px solid var(--f1-light-gray)' }}
      >
        {NAV_ITEMS.map(({ href, label, icon, ready }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={ready ? href : '#'}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors ${
                !ready ? 'opacity-40 pointer-events-none' : ''
              }`}
              style={{ color: active ? 'var(--f1-red)' : 'var(--f1-muted)' }}
            >
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}